var request = require('supertest');
var express = require('express');
var model = require('seraph-model');
var expose = require('../');
var assert = require('assert');
var async = require('async');
var seraph = require('disposable-seraph');
var _ = require('underscore');

describe('Seraph Model HTTP Methods', function() {
  var db, beer, user, app, beerResource;
  var neosv;
  
  before(function(done) {
    // allow 10 minutes for initial disposable-seraph startup.
    this.timeout(600000);
    this.slow(300000);
    seraph({ version: '2.0.3' }, function(err, dbObj, neoObj) {
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
    user.compose(beer, 'beers', 'likes', {many: true});
    app = express();
    beerResource = expose(beer, { relRoutes: true });
    app.use('/brews/', beerResource)
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
      .end(function(err, res) {
        user.read(res.body.id, function(err, contents) {
          assert.ok(!err);
          assert(contents.name == 'Jellybean');
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
        var id = res.body.id;
        delete res.body.id;
        request(app, err)
          .put('/user/' + id)
          .send(res.body)
          .expect(200)
          .end(function(err) {
            assert.ok(!err, err);
            request(app)
              .get('/user/' + id)
              .expect(200)
              .expect('Content-Type', /json/)
              .end(assertLike(done, { name: 'Jellybean', species: 'Cat', age: 13 }));
          })
      });
  });

  it('should handle deleting', function(done) {
    request(app)
      .post('/user')
      .set('Content-Type', 'application/json')
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

  it('should handle deleting with relationships', function(done) {
    request(app)
      .post('/user')
      .set('Content-Type', 'application/json')
      .send({ name: 'Jellybean', species: 'Cat' })
      .end(function(err, res) {
        var cat = res.body;
        request(app, err)
          .post('/user')
          .set('Content-Type', 'application/json')
          .send({ type: 'Magical Hat' })
          .end(function(err, res) {
            var hat = res.body;
            request(app, err)
              .post('/user/' + cat.id + '/rel/hat/' + hat.id)
              .set('Content-Type', 'application/json')
              .send({})
              .end(function(err, relres) {
                request(app, err)
                  .del('/user/' + cat.id)
                  .expect(200)
                  .end(function(err) {
                    assert.ok(!err, err);
                    request(app)
                      .get('/user/' + cat.id)
                      .expect(404)
                      .end(done);
                  });
              })
          });
      });
  });

  it('should give 404 for nonexistent objects', function(done) {
    request(app)
      .get('/user/5318008')
      .expect(404)
      .end(done);
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
          .expect(204)
          .end(function(err) {
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
          .expect(204)
          .end(function(err) {
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
      .set('Content-Type', 'application/json')
      .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
      .end(function(err, res) {
        request(app, err)
          .del('/brews/beer/' + res.body.id + '/ibus') 
          .expect(204)
          .end(function(err) {
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

  it('shouldnt try to create relationships if rel routes turned off', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'jon' })
      .end(function(err, res) {
        request(app)
          .post('/user/' + res.body.id + '/rel/someType/2')
          .expect(404)
          .end(done);
      });
  })

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
      .set('Content-Type', 'application/json')
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
      .set('Content-Type', 'application/json')
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
      .set('Content-Type', 'application/json')
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
      .set('Content-Type', 'application/json')
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
      .set('Content-Type', 'application/json')
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
      .set('Content-Type', 'application/json')
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

  it('should support composited models', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jon', beers: { name: 'Blekfjellet'}})
      .end(function(err, res) {
        assert(!err);
        request(app)
          .get('/user/' + res.body.id)
          .end(function(err, res) {
            assert(res.body.beers[0].name == 'Blekfjellet');
            request(app)
              .get('/user/' + res.body.id + '/beers')
              .end(function(err, res) {
                assert(!err);
                assert(res.body[0].name == 'Blekfjellet');
                done();
              });
          });
      });
  });

  it('should support updating the root of a composited model', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jon', beers: { name: 'Blekfjellet'}})
      .end(function(err, res) {
        assert(!err);
        request(app)
          .get('/user/' + res.body.id)
          .end(function(err, res) {
            assert(res.body.beers[0].name == 'Blekfjellet');
            res.body.name = 'Other person';
            res.body.beers[0].name = 'Other beer';
            request(app).put('/user/root/' + res.body.id)
              .send(res.body)
              .end(function(err, res) {
                assert(!err);
                assert(res.body.name == 'Other person');
                request(app)
                  .get('/user/' + res.body.id)
                  .end(function(err, res) {
                    assert(!err)
                    assert.equal(res.body.name, 'Other person');
                    assert.equal(res.body.beers[0].name, 'Blekfjellet');
                    done();
                  });
              });
          });
      });
  });

  it('should support updating only one composition', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jon', beers: { name: 'Blekfjellet'}})
      .end(function(err, res) {
        assert(!err);
        request(app)
          .get('/user/' + res.body.id)
          .end(function(err, res) {
            assert(res.body.beers[0].name == 'Blekfjellet');
            request(app).put('/user/' + res.body.id + '/beers')
              .send([{name: 'Hopwired'}, res.body.beers[0]])
              .end(function(err, newres) {
                assert(!err);
                assert(newres.body.length == 2);
                assert(newres.body[0].id);
                request(app)
                  .get('/user/' + res.body.id)
                  .end(function(err, res) {
                    assert(!err)
                    assert(res.body.beers.length == 2);
                    var beerNames = _.pluck(res.body.beers, 'name')
                    assert(_.contains(beerNames, 'Hopwired'))
                    assert(_.contains(beerNames, 'Blekfjellet'))
                    done();
                  });
              });
          });
      });
  });

  it('should have support for pushing to compositions', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jon'})
      .end(function(err, baseres) {
        assert(!err);
        request(app)
          .post('/user/' + baseres.body.id + '/beers')
          .send({ name: 'Blekfjellet' })
          .end(function(err, res) {
            assert(!err);
            assert(res.body.name == 'Blekfjellet');
            assert(res.body.id);
            request(app)
              .post('/user/' + baseres.body.id + '/beers')
              .send({ name: 'Amager IPA' })
              .end(function(err, res) {
                assert(!err);
                assert(res.body.name == 'Amager IPA');
                request(app)
                  .get('/user/' + baseres.body.id + '/beers')
                  .end(function(err, res) {
                    assert(!err);
                    assert(res.body[0].name == 'Blekfjellet');
                    assert(res.body[1].name == 'Amager IPA');
                    done();
                  });
              });
          });
      });
  });

  it('should properly save composited models as the correct type', function(done) {
    request(app)
      .post('/user')
      .send({ name: 'Jon'})
      .end(function(err, baseres) {
        assert(!err);
        request(app)
          .post('/user/' + baseres.body.id + '/beers')
          .send({ name: 'Blekfjellet' })
          .end(function(err, res) {
            assert(!err);
            assert(res.body.name == 'Blekfjellet');
            assert(res.body.id);
            request(app)
              .get('/brews/beer/' +res.body.id)
              .expect(200)
              .expect(res.body)
              .end(done);
          });
      });
  });

  it('should reject non-json mutation data', function(done) {
    request(app)
      .post('/brews/beer')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send({ name: 'Amazing Horse' })
      .expect(415)
      .end(done);
  });

  it('should not reject a json request specifying charset', function(done) {
    request(app)
      .post('/brews/beer')
      .set('Content-Type', 'application/json; charset=UTF-8')
      .send(JSON.stringify({ name: 'Super sweet' }))
      .expect(201)
      .end(done);
  });

  describe('access control', function() {
    it('should restrict read access', function(done) {
      beerResource.checkAccess = function(req, permission, id, callback) {
        callback(null, false);
      };
      request(app)
        .get('/brews/beer/1')
        .expect(401)
        .end(done);
    });
    it('should restrict write access but allow read access', function(done) {
      request(app)
        .post('/brews/beer')
        .send({ name: 'Super sweet' })
        .expect(201)
        .end(function(err, res) {
          if (err) return done(err);
          beerResource.checkAccess = function(req, permission, id, callback) {
            if (typeof id == 'function') callback = id;
            callback(null, permission == 'r');
          }
          request(app)
            .get('/brews/beer/' + res.body.id)
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err);
              request(app)
                .post('/brews/beer')
                .send({ name: 'Super sweet' })
                .expect(401)
                .end(done)
            })
        });
    });
    it('delete should be qualified as read access', function(done) {
      beerResource.checkAccess = function(req, permission, id, callback) {
        if (id == null) return callback(null, true);
        callback(null, false);
      }
      request(app)
        .post('/brews/beer')
        .send({ name: 'Super sweet' })
        .expect(201)
        .end(function(err, res) {
          if (err) return done(err);
          request(app)
            .del('/brews/beer/' + res.body.id)
            .expect(401)
            .end(done)
        });
    });

    it('should restrict access to defined properties', function(done) {
      request(app)
        .post('/brews/beer')
        .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
        .end(function(err, res) {
          beerResource.checkAccess = function(req, permission, id, callback) {
            callback(null, false);
          };
          request(app, err)
            .get('/brews/beer/' + res.body.id + '/brewery')
            .expect(401)
            .end(done)
        })
    });

    it('should restrict access to creating properties', function(done) {
      request(app)
        .post('/brews/beer')
        .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
        .end(function(err, res) {
          beerResource.checkAccess = function(req, permission, id, callback) {
            callback(null, false);
          };
          request(app, err)
            .post('/brews/beer/' + res.body.id + '/hops')
            .type("json")
            .send('"Simcoe, Cascade"')         
            .expect(401)
            .end(done)
        })
    });

    it('should restrict access to deleting properties', function(done) {
      request(app)
        .post('/brews/beer')
        .set('Content-Type', 'application/json')
        .send({ name: 'Linneaus IPA', brewery: 'Monadic Ale', ibus: 65 })
        .end(function(err, res) {
          beerResource.checkAccess = function(req, permission, id, callback) {
            callback(null, permission == 'r');
          };
          request(app, err)
            .del('/brews/beer/' + res.body.id + '/ibus') 
            .expect(401)
            .end(function(err) {
              assert(!err, err);
              request(app, err)
                .get('/brews/beer/' + res.body.id)
                .expect(200)
                .end(assertLike(done, { 
                  name: 'Linneaus IPA', 
                  brewery: 'Monadic Ale',
                  ibus: 65
                }));
            })
        })
    });

  });
})

