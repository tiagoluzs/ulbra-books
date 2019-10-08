var express = require('express');
var app = express();
var request = require('request');

var htmlparser = require("htmlparser");

var handler = new htmlparser.DefaultHandler(function (error, dom) {
    if (error) {

    } else {

    }
});

var parseUlbraHtml = function(body) {

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

  let results = [];

  qtd = tableResult.children.length;
  for(let i = 2; i < qtd; i++) {
    if(tableResult.children[i].name == "tr") {
      let author = tableResult.children[i].children[5].children[0].raw.trim();
      let title = tableResult.children[i].children[7].children[0].raw.trim();
      let publisher = tableResult.children[i].children[9].children[0].raw.trim();
      if(publisher == "BR") {
        publisher = null;
      }
      let year = tableResult.children[i].children[11].children[0].raw.trim();
      results.push({
        "author" : author,
        "title" : title ,
        "publisher" : publisher ,
        "year" : year
      });
    }
  }


  return results;

};


app.get('/', function (req, res) {
  res.send('Busca online Ulbra.');
});

app.get('/busca', function (req, res) {
  let query = req.query['query'] || null;
  let page = req.query['page'] || null;

  if(query == null) {
    res.json({
      error: true,
      errormsg: "No such query string"
    });
  } else {

    let url = "https://servicos.ulbra.br/ALEPH?";
    url += func + "&request="+query+"&find_code=WRD&local_base=ULB01&x=0&y=0&filter_code_4=WMA&filter_request_4=&filter_code_1=WLN&filter_request_1=&filter_code_2=WYR&filter_request_2=&filter_code_3=WYR&filter_request_3=";

    request(url, function (error, response, body) {
      if(error) {
        res.json({
          error: true,
          errormsg: error
        });
      } else {
        res.json(parseUlbraHtml(body));
      }
    });

  }
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
