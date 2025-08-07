const express = require('express');
const axios = require("axios");
const router = express.Router();
const { pipeline } = require('stream');
var http = require("http");
module.exports = router;

router.get("/minecraft", (req, res) => {
    axios.get("https://api.mcstatus.io/v2/status/java/play.thecubecollective.net")
        .then(apiResponse => {
            // Extract the data from the API response
            const mcData = apiResponse.data;

            // Render the index.ejs view, passing the Minecraft server data
            res.render("minecraft.ejs", { mcData });
        })
        .catch(error => {
            // Handle any errors
            console.error("Error fetching Minecraft status:", error);

            // Optionally, pass an error message or default data to the view
            res.render("minecraft.ejs", { mcData: null, error: "Unable to fetch server data" });
        });
});

router.get("/", (req, res) => {
    res.redirect("index");
});

router.get("/map", (req, res) => {
    res.render("map.ejs");
});

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

// BlueMap reverse proxy - handles /bluemap and all sub-paths
router.all("/bluemap*", (req, res) => {
    // Ensure the URL has a trailing slash for proper BlueMap base path
    if (req.url === '/bluemap') {
        return res.redirect('/bluemap/');
    }
    
    // Remove /bluemap from the path and forward to BlueMap server
    var path = req.url.replace('/bluemap', '');
    if (!path.startsWith('/')) {
        path = '/' + path;
    }
    
    console.log("BlueMap proxy - Original URL:", req.url, "Proxied path:", path);
    
    // Set up proxy headers similar to how NGINX would do it
    var proxyHeaders = { ...req.headers };
    // Remove headers that might cause issues
    delete proxyHeaders['host'];
    delete proxyHeaders['connection'];
    delete proxyHeaders['upgrade'];
    
    // Add standard reverse proxy headers
    proxyHeaders['x-forwarded-for'] = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    proxyHeaders['x-forwarded-proto'] = req.protocol || (req.headers['x-forwarded-proto'] || 'http');
    proxyHeaders['x-forwarded-host'] = req.get('host');
    proxyHeaders['x-real-ip'] = req.ip || req.connection.remoteAddress;
    
    // Set the host header to the target server
    proxyHeaders['host'] = 'play.thecubecollective.net:6361';
    
    var options = {
        hostname: 'play.thecubecollective.net',
        port: 6361,
        path: path,
        method: req.method,
        headers: proxyHeaders,
        timeout: 30000
    };
    
    var proxy = http.request(options, function(response) {
        console.log(`BlueMap response: ${response.statusCode} for ${path} (Content-Type: ${response.headers['content-type'] || 'none'})`);
        
        // Copy response headers but filter out problematic ones
        var responseHeaders = { ...response.headers };
        delete responseHeaders['transfer-encoding'];
        delete responseHeaders['connection'];
        
        // Fix any location headers that might have absolute URLs
        if (responseHeaders.location) {
            responseHeaders.location = responseHeaders.location.replace(/^https?:\/\/[^\/]+/, '');
            if (responseHeaders.location.startsWith('/') && !responseHeaders.location.startsWith('/bluemap')) {
                responseHeaders.location = '/bluemap' + responseHeaders.location;
            }
        }
        
        res.set(responseHeaders);
        res.status(response.statusCode);
        
        // For HTML responses, we need to rewrite URLs in the content
        if (response.headers['content-type'] && response.headers['content-type'].includes('text/html')) {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => {
                body += chunk;
            });
            response.on('end', () => {
                // Rewrite relative URLs to include /bluemap prefix
                body = body.replace(/href="\.\/assets\//g, 'href="/bluemap/assets/');
                body = body.replace(/src="\.\/assets\//g, 'src="/bluemap/assets/');
                body = body.replace(/href="\/(?!bluemap)/g, 'href="/bluemap/');
                body = body.replace(/src="\/(?!bluemap)/g, 'src="/bluemap/');
                body = body.replace(/"\/assets\//g, '"/bluemap/assets/');
                body = body.replace(/'\/assets\//g, "'/bluemap/assets/");
                body = body.replace(/url\(\.\/assets\//g, 'url(/bluemap/assets/');
                body = body.replace(/url\("\.\/assets\//g, 'url("/bluemap/assets/');
                body = body.replace(/url\('\.\/assets\//g, "url('/bluemap/assets/");
                
                // Also rewrite any fetch() or API calls in JavaScript
                body = body.replace(/fetch\("\/(?!bluemap)/g, 'fetch("/bluemap/');
                body = body.replace(/fetch\('\/(?!bluemap)/g, "fetch('/bluemap/");
                
                res.send(body);
            });
        } else {
            // For non-HTML responses, just pipe through
            response.pipe(res);
        }
    });
    
    proxy.on("error", function(err) {
        console.error("BlueMap proxy error:", err);
        if (!res.headersSent) {
            res.status(502).send("Bad Gateway - Unable to connect to BlueMap server: " + err.message);
        }
    });
    
    proxy.on("timeout", function() {
        console.error("BlueMap proxy timeout");
        proxy.destroy();
        if (!res.headersSent) {
            res.status(504).send("Gateway Timeout");
        }
    });
    
    // Handle client disconnect
    req.on('close', function() {
        proxy.destroy();
    });
    
    // Pipe the request body for POST/PUT requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        req.pipe(proxy);
    } else {
        proxy.end();
    }
});

router.get("/*", (req, res) => {
    if (!req.url.startsWith('/index') && !req.url.startsWith('/bluemap')) {
        console.log("URL = ",req.url);
        var options = {
            host: 'play.thecubecollective.net',
            port: 6361,
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
    
  