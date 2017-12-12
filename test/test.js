var promisify = require('js-promisify');
var chai = require('chai');
var chaiAsPromised = require("chai-as-promised");
var should = require('chai').should();
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var ncp = require('ncp').ncp;

var secretizer = require('../index.js');

chai.use(chaiAsPromised);

describe('secretizer', function() {

    var tmpDirPath = path.join(__dirname, 'tmp/');
    var fixturesSrc = path.join(__dirname, '/fixtures/');
    var fixturesTmp = path.join(__dirname, '/tmp/fixtures/');

    before(function(done) {
        // Make "tmp" folder
        fs.mkdirSync(tmpDirPath);
        //copy the source fixtures to tmp directory
        ncp(fixturesSrc, fixturesTmp, function (err) {
            if (err) {
                return console.error(err);
            }
                console.log('done!');
                done();
            }
        );
    });

    after(function() {
        // Delete "tmp" folder
        rimraf.sync(tmpDirPath);
    });

    describe('#check', function() {

        it('resolves as promised', function(done) {
            secretizer.all(fixturesTmp)
                .then(function() {
                    done();
                })
                .catch(function() {
                    throw new Error('secretizer.all should not reject');
                })
        });
    });

});
