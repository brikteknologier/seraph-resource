var request = require('supertest');
var express = require('express');
var model = require('seraph-model');
var expose = require('../');
var assert = require('assert');
var async = require('async');
var seraph = require('disposable-seraph');

describe('Seraph Model HTTP Methods', function() {
  var db, beer, user, app;
  var neosv;
  
  before(function(done) {
    seraph(function(err, dbObj, neoObj) {
      if (err) return done(err);
      neosv = neoObj;
      db = dbObj;
      setTimeout(function() { done() }, 200);
    });
  });

  after(function(done) {
    neosv.stop(done);
  });

  var assertLike = function(done, obj) {
    return function(err, res) {
      if (err) return done(err);
      Object.keys(obj).forEach(function(key) {
        assert(obj[key] == res.body[key], obj[key] + ' != ' + res.body[key]);
      });
      done(null,res);
    };
  };

  beforeEach(function() {
    beer = model(db, 'beer');
    beer.fields = ['name', 'fields', 'ibus', 'hops', 'brewery'];
    user = model(db, 'user');
    app = express();
    app.use('/brews/', expose(beer))
    app.use(expose(user))
  });

  it('should save a model', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .expect('Content-Type', /json/)
      .expect(201)
      .end(function(err, res) {
        if (err) return done(err);
        assert(res.body.name == 'Jellybean');
        assert(res.body.species == 'Cat');
        done();
      })
  });

  it('should retrieve a model', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        request(app)
          .get('/user/' + res.body.id)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function(err, res) {
            if (err) return done(err);
            assert(res.body.name == 'Jellybean');
            assert(res.body.species == 'Cat');
            done();
          })
      });
  })

  it('should save it as the right type of model', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function() {
        db.index.read('nodes', 'type', 'user', function(err, contents) {
          assert.ok(contents.length > 0);
          done();
        })
      });
  });

  it('should handle optional root prefixes', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'The Harvest', brewery: 'Bridge Road' })
      .expect('Content-Type', /json/)
      .expect(201)
      .end(assertLike(done, {name:'The Harvest', brewery:'Bridge Road'}))
  });

  it('should handle updating', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        res.body.age = 13;
        request(app, err)
          .put('/user/' + res.body.id)
          .send(res.body)
          .expect(200)
          .expect(res.body)
          .end(function(err) {
            assert.ok(!err, err);
            request(app)
              .get('/user/' + res.body.id)
              .expect(200)
              .expect('Content-Type', /json/)
              .end(assertLike(done, { name: 'Jellybean', species: 'Cat', age: 13 }));
          })
      });
  });

  it('should handle updating without url ID', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        res.body.age = 13;
        request(app, err)
          .put('/user/')
          .send(res.body)
          .expect(200)
          .expect(res.body)
          .end(function(err) {
            assert.ok(!err, err);
            request(app)
              .get('/user/' + res.body.id)
              .expect(200)
              .expect('Content-Type', /json/)
              .end(assertLike(done, { name: 'Jellybean', species: 'Cat', age: 13 }));
          })
      });
  });

  it('should handle updating without object ID', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        res.body.age = 13;
        delete res.body.id;
        request(app, err)
          .put('/user/0')
          .send(res.body)
          .expect(200)
          .end(function(err) {
            assert.ok(!err, err);
            request(app)
              .get('/user/0')
              .expect(200)
              .expect('Content-Type', /json/)
              .end(assertLike(done, { name: 'Jellybean', species: 'Cat', age: 13 }));
          })
      });
  });

  it('should handle deleting', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        request(app, err)
          .del('/user/' + res.body.id)
          .expect(200)
          .end(function(err) {
            assert.ok(!err, err);
            request(app)
              .get('/user/' + res.body.id)
              .expect(404)
              .end(done);
          })
      });
  });

  it('should be able to access defined properties', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .get('/brews/beer/' + res.body.id + '/brewery')
          .expect(200)
          .expect('"Monadic Ale"')
          .end(done)
      })
  });

  it('should be give 404 for expected but unset props', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .get('/brews/beer/' + res.body.id + '/hops')
          .expect(404)
          .end(done)
      })
  });

  it('should be able to create properties', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .post('/brews/beer/' + res.body.id + '/hops')
          .type("json")
          .send('"Simcoe, Cascade"')         
          .expect(201)
          .end(function(err, res) {
            assert(res.body.hops == "Simcoe, Cascade");
            assert(!err,err);
            request(app, err)
              .get('/brews/beer/' + res.body.id)
              .expect(200)
              .end(assertLike(done, { 
                name: 'Linneaus IPA', 
                brewery: 'Monadic Ale', 
                ibus: 65,
                hops: "Simcoe, Cascade" 
              }));
          })
      })
  });

  it('should be able to update properties', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .put('/brews/beer/' + res.body.id + '/ibus')
          .type("json")
          .send(87)         
          .expect(200)
          .end(function(err,res) {
            assert(res.body.ibus == 87);
            assert(!err,err);
            request(app, err)
              .get('/brews/beer/' + res.body.id)
              .expect(200)
              .end(assertLike(done, { 
                name: 'Linneaus IPA', 
                brewery: 'Monadic Ale', 
                ibus: 87
              }));
          })
      })
  });

  it('should be able to delete properties', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .del('/brews/beer/' + res.body.id + '/ibus') 
          .expect(200)
          .end(function(err, res) {
            assert(!res.body.ibus);
            assert(!err,err);
            request(app, err)
              .get('/brews/beer/' + res.body.id)
              .expect(200)
              .end(assertLike(done, { 
                name: 'Linneaus IPA', 
                brewery: 'Monadic Ale'
              }));
          })
      })
  });

  it('should be able to create a relationship', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/2')
          .send({key: 'value'})
          .expect(200)
          .end(assertLike(function(err, res) {
              assert(!err);
              assert(res.body.properties.key == 'value');
              done()
            }, {
            start: res.body.id, end: 2,  
            type:'someType'
          }));
      });
  })
  it('should be able to create a relationship with no props', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/3')
          .expect(200)
          .end(function(err, res) {
            assert(!err);
            assert(res.body.id);
            assert(!Object.keys(res.body.properties).length);
            done();
          });
      });
  })

  it('should retrieve a relationship', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/2')
          .end(function(err, res2) {
            request(app)
              .get('/brews/beer/'+res.body.id+'/rel/someType/out')
              .expect(200)
              .end(function(err,res) {
                assert(!err);
                assert(res.body.length == 1);
                done();
              });
          });
      });
  })

  it('should retrieve all relevant relationships', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        var r0 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/2');
        var r1 = request(app)
          .post('/brews/beer/2/rel/someType/' + res.body.id);
        var r2 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/other/2');
        async.series([
          r0.end.bind(r0),
          r1.end.bind(r1),
          r2.end.bind(r2),
        ], function(err, res2) {
          request(app)
            .get('/brews/beer/'+res.body.id+'/rel/someType')
            .expect(200)
            .end(function(err,res) {
              assert(res.body.length == 2);
              assert(!err);
              done();
            });
        })
      });
  })

  it('should retrieve all relevant incoming relationships', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        var r0 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/3');
        var r1 = request(app)
          .post('/brews/beer/3/rel/someType/' + res.body.id);
        var r2 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/other/3');
        async.series([
          r0.end.bind(r0),
          r1.end.bind(r1),
          r2.end.bind(r2)
        ], function(err, res2) {
          request(app)
            .get('/brews/beer/'+res.body.id+'/rel/someType/in')
            .expect(200)
            .end(function(err, res) {
              assert(!err);
              assert(res.body.length == 1);
              assert(res.body[0].start == 3);
              done()
            });
        })
      });
  })

  it('should retrieve all relevant outgoing relationships', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        var r0 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/someType/4');
        var r1 = request(app)
          .post('/brews/beer/4/rel/someType/'+res.body.id);
        var r2 = request(app)
          .post('/brews/beer/' + res.body.id + '/rel/other/4');
        async.series([
          r0.end.bind(r0),
          r1.end.bind(r1),
          r2.end.bind(r2)
        ], function(err, res2) {
          request(app)
            .get('/brews/beer/'+res.body.id+'/rel/someType/out')
            .expect(200)
            .end(function(err, res) {
              assert(!err);
              assert(res.body.length == 1);
              assert(res.body[0].end == 4);
              done();
            });
        })
      });
  })

  it('should retrieve all outgoing relationships nodes', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        if (err) return done(err);
        request(app)
          .post('/brews/beer')
          .send({ name: 'Pliny the Younger' })
          .end(function(err, res2) {
            if (err) return done(err);
            request(app)
              .post('/brews/beer/' + res.body.id + '/rel/related_to/' + res2.body.id)
              .end(function(err, res3) {
                request(app)
                  .get('/brews/beer/' + res.body.id + '/rel/related_to/out/nodes')
                  .expect(200)
                  .expect([{
                    id: res2.body.id, name: 'Pliny the Younger'
                  }]).end(done);
              });
          })
      });
  });

  it('should retrieve all incoming relationships nodes', function(done) {
    request(app)
      .post('/brews/beer')
      .send({ name: 'Pliny the Elder' })
      .end(function(err, res) {
        if (err) return done(err);
        request(app)
          .post('/brews/beer')
          .send({ name: 'Pliny the Younger' })
          .end(function(err, res2) {
            if (err) return done(err);
            request(app)
              .post('/brews/beer/' + res2.body.id + '/rel/related_to/' + res.body.id)
              .end(function(err, res3) {
                request(app)
                  .get('/brews/beer/' + res.body.id + '/rel/related_to/in/nodes')
                  .expect(200)
                  .expect([{
                    id: res2.body.id, name: 'Pliny the Younger'
                  }]).end(done);
              });
          })
      });
  })

  it('should not call res.end incorrectly', function(done) {
    request(app)
      .get('/user/name')
      .expect(404)
      .end(done);
  });

  it('should allow overloading of the GET point.', function(done) {
    app.get('/user/jellybean', function(req,res) {
      res.send("Jellybean!", 200);
    });
    request(app)
      .post('/user')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err,res) {
        request(app)
          .get('/user/' + res.body.id)
          .expect(200)
          .expect({ name: 'Jellybean', species: 'Cat', id: res.body.id })
          .end(function() {
            request(app)
              .get('/user/jellybean')
              .expect(200)
              .expect("Jellybean!")
              .end(done)
          })
      });
  })
})
