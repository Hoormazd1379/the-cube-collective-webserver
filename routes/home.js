const express = require('express');
const router = express.Router();
const { pipeline } = require('stream')
var http = require("http")
module.exports = router;

router.get("/index", (req, res) => {
    res.render("index.ejs");
});

router.get("/", (req, res) => {
    res.redirect("index");
});

router.get("/map", (req, res) => {
    var url = req.url.slice(4);
    console.log("URL = ",url);
    var options = {
        host: 'play.thecubecollective.net',
        port: 7472,
        path: url,
        method: req.method,
        headers: req.headers
      }
      
      proxy = http.request(options, function(response){ 
  
        response.on("data",function(chunk){
            res.write(chunk);
        });
  
        response.on("end", function(){
            res.end();
        });
  
      });
      
      proxy.once("error", function(){ });
      
      pipeline(req, proxy, () => {
        proxy.end();
      });
});

router.get("/*", (req, res) => {
    if (!req.url.startsWith('/index')) {
        console.log("URL = ",req.url);
        var options = {
            host: 'play.thecubecollective.net',
            port: 7472,
            path: req.url,
            method: req.method,
            headers: req.headers
          }
          
          proxy = http.request(options, function(response){ 
            
            if(response.statusCode > 399) {
                res.redirect("/index");
            }

            else {
                response.on("data",function(chunk){
                    res.write(chunk);
                });
          
                response.on("end", function(){
                    res.end();
                });
            }
      
          });
          
          pipeline(req, proxy, () => {
            proxy.end();
          });
    }
    else {
        res.redirect("/index");
    }
});
    
  