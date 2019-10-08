var express = require('express');
var app = express();
var request = require('request');
var htmlparser = require("htmlparser");

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

var parseDetailKey = function(url) {
    let set_number = url.match(/set_number=([0-9]+)\&/)[1];
    let set_entry = url.match(/set_entry=([0-9]+)\&/)[1];
    return set_number + "_" + set_entry;
};

var parseDetails = function(body) {
  // parser não está conseguindo lidar com o HTML,
  // provavelmente com problemas de formatação
  // parsing na mão
  let json = {};
  let tb_ini_txt = '<table cellspacing=2 border=0 width=100%>';
  let tb_ini_index = body.indexOf(tb_ini_txt);
  let tb_fim_index = body.indexOf("</table>",tb_ini_index);
  let tb_html = body.substring(tb_ini_index,tb_fim_index);

  let dados = tb_html.replace(/(\r\n|\n|\r)/gm, "");

  dados = dados
    .replaceAll("&nbsp;"," ");

  dados = dados.match(/<td[^>](.*?)<\/td>/g);

  for(let i = 0; i < dados.length; i++) {
    dados[i] = dados[i]
      .replaceAll("<td >","")
      .replaceAll("</td>","")
      .replace(/<[^>]*>?/gm, '')
      .trim();
  }
  json.details = [];
  for(let i = 0; i < (dados.length/2); i++) {
    let v = i*2;
    json.details.push({
      key: dados[v],
      value: dados[v+1]
    })
  }
  return json;
};

var parseResults = function(body) {
  var handler = new htmlparser.DefaultHandler();
  var parser = new htmlparser.Parser(handler);
  parser.parseComplete(body);
  let ch = handler.dom[2].children[3].children;

  let qtd = ch.length;
  let qtdTable = 0;
  let tableResult = null;
  for(let i = 0; i < qtd ; i++) {
    if(ch[i].name == "table") {
      qtdTable++;
    }
    if(qtdTable == 4) {
      tableResult = ch[i];
      break;
    }
  }

  let json = {
    results : []
  };

  if(tableResult != null) {
    qtd = tableResult.children.length;
    for(let i = 2; i < qtd; i++) {
      if(tableResult.children[i].name == "tr") {
        let tr = tableResult.children[i];
        let url = tr.children[1].children[0].attribs['HREF'];
        let author = tr.children[5].children[0].raw.trim();
        let title = tr.children[7].children[0].raw.trim();
        let publisher = tr.children[9].children[0].raw.trim();
        if(publisher == "BR") {
          publisher = null;
        }
        let year = tr.children[11].children[0].raw.trim();


        let detail_key = parseDetailKey(url);

        json.results.push({
          "author" : author,
          "title" : title ,
          "publisher" : publisher ,
          "year" : year,
          "detail_key" : detail_key
        });
      }
    }
  }
  return json;
};

var parseSession = function(body) {
  try {
      return body.match(/ALEPH\/(.+)\?/)[1];
  } catch(e){
    return null;
  }
};

var validateSession = function(req,res,next) {
  let session = req.query['session'] || null;
  if(/^[A-Z0-9]+\-[0-9]+$/.test(session)) {
    next();
  } else {
    res.status(403).json({
      error: true,
      errormsg: "Invalid session"
    });
  }
};

app.get('/', function (req, res) {
  res.send('Busca online Ulbra.');
});

app.get('/login',function(req,res){
  let cgu = req.query['cgu'];
  let url = "https://servicos.ulbra.br/ALEPH";
  request(url, function (error, response, body) {
    if(error) {
      res.status(500).json({
        error: true,
        errormsg: "Can't create session"
      });
    } else {
      let session = parseSession(body);

      // request do login
      let data = {
        func: "login-session",
        login_source: "LOGIN-BOR",
        bor_verification: "123",
        bor_library: "ULB50",
        bor_id: cgu,
        x: "56",
        y: "8"
      };

      let url_login = url + "/" + session;

      request.post({url:url_login, form: data}, function(err,httpResponse,body){
        let session_login = parseSession(body);
        res.json({
          error: false,
          errormsg: null,
          session: session_login
        });
      })
    }
  });
});

app.get('/search', validateSession, function (req, res) {
  let query = req.query['query'] || null;
  let session = req.query['session'] || null;
  let page = req.query['page'] || null;
  let sort = req.query['sort'] || null;

  let func = "func=find-b";
  if(sort == "" || sort == null || sort == "aut_tit") {
    func = "func=find-b";
  } else if(sort == "aut_ano_atual") {
    func = "func=short-sort&sort_option=01---A03---D";
  } else if(sort == "tit_ano_atual") {
    func = "func=short-sort&sort_option=02---A03---D";
  } else if(sort == "ano_atual_tit") {
    func = "func=short-sort&sort_option=03---D02---A";
  }

  if(query == null) {
    res.json({
      error: true,
      errormsg: "No such query string"
    });
  } else {
    let url = "https://servicos.ulbra.br/ALEPH?";
    if(session) {
      url = "https://servicos.ulbra.br/ALEPH/" + session + "?";
    }
    url += func + "&request="+query+"&find_code=WRD&local_base=ULB01&x=0&y=0&filter_code_4=WMA&filter_request_4=&filter_code_1=WLN&filter_request_1=&filter_code_2=WYR&filter_request_2=&filter_code_3=WYR&filter_request_3=";
    request(url, function (error, response, body) {
      if(error) {
        res.status(500).json({
          error: true,
          errormsg: error
        });
      } else {
        res.json(parseResults(body));
      }
    });
  }
});

var validateDetailKey = function(req,res,next) {
  let detail_key = req.params['detail_key'] || null;
  if(/^[0-9]+\_[0-9]+$/.test(detail_key)){
    next();
  } else {
    res.status(500).json({
      error: true,
      errormsg: "Invalid detail key"
    });
  }
};

app.get('/detail/:detail_key', validateSession, validateDetailKey, function (req, res) {
  let session = req.query['session'] || null;
  let d = req.params['detail_key'].split("_");
  let url = "https://servicos.ulbra.br/ALEPH/" + session + "?func=full-set-set&set_number="+d[0]+"&set_entry="+d[1]+"&format=999";

  request(url, function (error, response, body) {
    if(error) {
      res.status(500).json({
        error: true,
        errormsg: error
      });
    } else {
      res.json(parseDetails(body));
    }
  });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
