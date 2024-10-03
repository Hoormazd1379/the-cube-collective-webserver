const express = require('express');
const axios = require("axios");
const router = express.Router();
const { pipeline } = require('stream');
var http = require("http");
module.exports = router;

router.get("/index", (req, res) => {
    axios.get("https://api.mcstatus.io/v2/status/java/play.thecubecollective.net")
        .then(apiResponse => {
            // Extract the data from the API response
            const mcData = apiResponse.data;

            // Render the index.ejs view, passing the Minecraft server data
            res.render("index.ejs", { mcData });
        })
        .catch(error => {
            // Handle any errors
            console.error("Error fetching Minecraft status:", error);

            // Optionally, pass an error message or default data to the view
            res.render("index.ejs", { mcData: null, error: "Unable to fetch server data" });
        });
});

router.get("/", (req, res) => {
    res.redirect("index");
});

router.get("/map", (req, res) => {
    res.render("map.ejs");
});

router.get("/dynmap", (req, res) => {
    var url = req.url.slice(7);
    url = "/" + url;
    console.log("URL = ",url);
    var options = {
        host: 'play.thecubecollective.net',
        port: 6707,
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
            port: 6707,
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
    
  