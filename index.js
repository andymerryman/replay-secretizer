const fs = require('fs');
const path = require('path');

//always replace the value of these query params with a pattern matching [0-9a-zA-Z]+
let defaultParamsToRegexify = [
    "api-key",
    "api_key",
    "apikey"
]

//always replace capture group 2 (the kv pair value) in these patterns with 'redacted'
let defaultStringsAndPatternsToRedact = [
    new RegExp(/(Authorization\:\ Basic\ )([0-9a-zA-Z.=?&_-]+)/ig), //any basic auth headers
    new RegExp(/(apikey\=)([0-9a-zA-Z_-]+)/ig), //any api keys params in the body
    new RegExp(/(api\-key\=)([0-9a-zA-Z_-]+)/ig), //any api keys params in the body, dasherized
    new RegExp(/(api\_key\=)([0-9a-zA-Z_-]+)/ig) //any api keys params in the body, underscored
]

function regexifyAndRedactFixturesInDirectory(dir, opts){
    return new Promise(function (resolve, reject) {
        regexifyFixturesInDirectory(dir, opts)
        .then(function(){
            return redactFixturesInDirectory(dir,opts)
        })
        .then(function(){
            resolve();
        })
        .catch(function(err){
            console.error(err.message);
            reject(err);
        });
    });
}

function regexifyFixturesInDirectory(dir, opts){
    return new Promise(function (resolve, reject) {
        //get all filepaths in the specified dir
        getFilesIn(dir)
        //regexify all fixture paths, removing secrets and replacing with regex pattern
        .then(function(filePathsArr){
            var fileOps = [];
            for (var i = 0; i < filePathsArr.length; i++){
                //console.log(filePathsArr[i]);
                fileOps.push(regexifyFile(filePathsArr[i]));
            }
            return Promise.all(fileOps);
        })
        .catch(function(err){
            console.error(err.message);
            reject();
        })
        .then(function(data){
            resolve();
        });
    });
}

function redactFixturesInDirectory(dir, opts){
    return new Promise(function (resolve, reject) {
        getFilesIn(dir)
        .then(function(filePathsArr){
            var fileOps = [];
            for (var i = 0; i < filePathsArr.length; i++){
                //console.log(filePathsArr[i]);
                fileOps.push(redactFile(filePathsArr[i]));
            }
            return Promise.all(fileOps);
        })
        .catch(function(err){
            console.error(err.message);
            reject();
        })
        .then(function(data){
            resolve();
        });
    });
}

function regexifyFile(filepath, secrets_arr){
    return new Promise(function (resolve, reject) {
        fs.readFile(filepath,"utf8", function read(err, data) {
            //console.log("regexifying " + filepath);
            if (err) {
                throw err;
            }
            var content = data.split("\n");

            //stop here if the url's already a regex
            if (content[0].indexOf("REGEXP") !== -1)
                return resolve();

            //operate on the first line of the file here. We're going to change the path
            //to be a regex that accepts any API key (for testing / secret-exposure purposes).
            //Example: This should take a line that reads
            //  GET /api/v1/content/1.json?api-key=mysecretkey
            //and change it to
            //  GET REGEX /\/api\/v1\/content\/1\.json\?api\-key\=[0-9a-zA-Z]+/g
            var outputStr = content[0]

                    //add the token REGEX in between the method and the path
                    .replace(/([A-Z]+)\ (.*)/, "$1 REGEXP $2")

                    //escape special characters to start to transform the path to a regex
                    .replace(/[/.=?&_-]+/g, function(a, b){
                        return `\\${a}`;
                    });

                for (var i = 0; i < defaultParamsToRegexify.length; i++){
                    //replace any specified param value with an unescaped string version of a regex that'll match
                    var theParam = defaultParamsToRegexify[i];
                    theParam = theParam.replace(/[/.=?&_-]+/g, function(a, b){
                        return `\\\\${a}`;
                    });
                    var rx = new RegExp(theParam + "\\\\=([0-9a-zA-Z]+)", 'g');
                    //console.log(rx, 'expression');
                    theParam = theParam.split("\\\\").join("\\");
                    outputStr = outputStr.replace(rx, theParam + "\\=[0-9a-zA-Z]+");
                }
                //finally, wrap the regex portion with forward-slashes, add markers for the beginning and end of the
                //string for a more exact match, and run tell it to run globally
                outputStr = outputStr.replace(/(\S+)$/g, "/^$1$/g");

            content[0] = outputStr;
            content = content.join("\n");
            console.log(content);

            //update the file with the modified content
            fs.writeFile(filepath, content, { encoding: 'utf-8' }, function(err) {
                if(err) {
                    console.error(err);
                    return reject();
                }
                resolve();
            });
        });
    });
}

function redactFile(filepath, stringsAndPatternsToRedactArr){
    stringsAndPatternsToRedactArr = stringsAndPatternsToRedactArr || defaultStringsAndPatternsToRedact ;
    return new Promise(function (resolve, reject) {
        fs.readFile(filepath,"utf8", function read(err, data) {
            if (err) {
                throw err;
            }

            //remove any specified strings from the file contents
            var content = data,
                toRedact;
            for (var i = 0; i< stringsAndPatternsToRedactArr.length; i++){
                toRedact = stringsAndPatternsToRedactArr[i];
                if (typeof toRedact.exec === 'function'){
                    content = content.replace(toRedact, "$1redacted")
                } else {
                    content = content.split(stringsToRedactArr[i]).join("redacted");
                }

            }

            //console.log(content);
            //update the file with the modified content
            fs.writeFile(filepath, content, { encoding: 'utf-8' }, function(err) {
                if(err) {
                    console.error(err);
                    return reject();
                }
                resolve();
            });

        });
    });
}

//utility function to return all file paths under a directory as an array
function getFilesIn (dir) {
    return new Promise(function (resolve, reject) {
      var results = [];
      fs.readdir(dir, function(err, list) {
        if (err) return reject(err);
        var pending = list.length;
        if (!pending) return resolve(results);
        list.forEach(function(file) {
          file = path.resolve(dir, file);
          fs.stat(file, function(err, stat) {
            if (stat && stat.isDirectory()) {
              getFilesIn(file).then(function(res) {
                results = results.concat(res);
                if (!--pending)
                    return resolve(results);
              });
            } else {
              results.push(file);
              if (!--pending)
                return resolve(results);
            }
          });
        });
      });
  });
}


module.exports = {
    all: regexifyAndRedactFixturesInDirectory,
    regexify: regexifyFixturesInDirectory,
    redact: redactFixturesInDirectory,
    defaultStringsAndPatternsToRedact: defaultStringsAndPatternsToRedact,
    defaultParamsToRegexify: defaultParamsToRegexify
}
