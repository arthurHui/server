const express = require('express');
const app = express();
const session = require('cookie-session');
const formidable = require('formidable');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const assert = require('assert');
const fs = require('fs');
const mongourl = 'mongodb+srv://username:password@cluster0.fplts.mongodb.net/test?retryWrites=true&w=majority';
const dbName = 'test';

app.use(express.json());
app.use(express.urlencoded({extended:true})); 
app.set('view engine', 'ejs');
const SECRETKEY = 'restaurant';
var owner = "";

const users = new Array(
	{name: 'student', password: ''},
	{name: 'demo', password: ''}
);

app.use(session({
    name: 'loginSession',
    keys: [SECRETKEY]
  }));

const findDocument = (db, criteria, callback) => {
    let cursor = db.collection('restaurant').find(criteria);
    console.log(`findDocument: ${JSON.stringify(criteria)}`);
    cursor.toArray((err,docs) => {
        assert.equal(err,null);
        console.log(`findDocument: ${docs.length}`);
        callback(docs);
    });
}

const handle_Find = (res,req, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        findDocument(db, criteria, (docs) => {
            client.close();
            console.log("Closed DB connection");
            res.status(200).render('find',{nRestaurants: docs.length, restaurants: docs,name:req.session.username});
        });
    });
}

const handle_Details = (res, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        /* use Document ID for query */
        let DOCID = {};
        DOCID['_id'] = ObjectID(criteria._id)
        findDocument(db, DOCID, (docs) => {  // docs contain 1 document (hopefully)
            client.close();
            console.log("Closed DB connection");
            res.status(200).render('detail', {restaurant: docs[0]});
        });
    });
}

const handle_Edit = (res,req, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        /* use Document ID for query */
            let DOCID = {};
            DOCID['_id'] = ObjectID(criteria._id);
            DOCID['owner'] = req.session.username;
            findDocument(db, DOCID, (docs) => {  // docs contain 1 document (hopefully)
            console.log(docs);
            if(docs[0] == null){
                client.close();
                console.log("Closed DB connection");
                res.redirect('/editerr');
            }else{
                client.close();
                console.log("Closed DB connection");
                res.status(200).render('edit', {restaurant: docs[0]});
            }

        });
    });
}

const updateDocument = (criteria, updateDoc, callback) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);
         db.collection('restaurant').updateOne(criteria,
            {
                $set : updateDoc
            },
            (err, results) => {
                client.close();
                assert.equal(err, null);
                callback(results);
            }
        );
    });
}

const handle_Update = (req, res) => {

    var item = {}
    var DOCID = {};
    const form = new formidable.IncomingForm(); 
    form.parse(req, (err, fields, files) => {
    DOCID['_id'] = ObjectID(fields._id);  
    item['name'] = fields.name;
    item['cuisine'] = fields.cuisine;
    item['address'] = {street: fields.street,
        building: fields.building,
        zipcode: fields.zipcode,
        coord: {lon: fields.lon,lat: fields.lat} };
        if (files.sampleFile.size > 0) {
            fs.readFile(files.sampleFile.path, (err,data) => {
                assert.equal(err,null);
                item['photo'] = new Buffer.from(data).toString('base64');
                updateDocument(DOCID, item, (results) => {
                    res.redirect('/find');

                });
            });
        } else {
            updateDocument(DOCID, item, (results) => {
                res.redirect('/find');
           });
        }
    });
}

const handle_Delete = (res,req, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);
        /* use Document ID for query */
        let DOCID = {};
        DOCID['_id'] = ObjectID(criteria._id)
        DOCID['owner'] = req.session.username;
        db.collection("restaurant").deleteOne(DOCID, (err,obj) => {
            assert.equal(null, err);
            if(obj.result.n == 0){
                client.close();
                console.log("Closed DB connection");
                res.redirect('/removeerr');
            }else{
                console.log('Deleted');
                client.close();
                res.status(200).render('remove');
            }
        });
    });
}

const score_Update = (req, res) => {
    var item = {}
    var DOCID = {};
    DOCID['_id'] = ObjectID(req.query._id);  
    item['name'] = req.session.username;
    item['score'] = req.body.score;

    updatescore(DOCID, item, (results) => {
        res.redirect('/ratesuc');
    });
    
}

const updatescore = (criteria, updateDoc, callback) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);
         db.collection('restaurant').updateOne(criteria,
            {
                $push :{ grades:updateDoc}
            },
            (err, results) => {
                client.close();
                assert.equal(err, null);
                callback(results);
            }
        );
    });
}

app.get('/', (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
        console.log(req.session);		
        res.redirect('/find');
    }
});

app.get('/login', (req,res) => {
	res.status(200).render('login',{});
});

app.post('/login', (req,res) => {
	users.forEach((user) => {
		if (user.name == req.body.name && user.password == req.body.password) {			
			req.session.authenticated = true;        
            req.session.username = req.body.name;	 
		}
    });
	res.redirect('/');
});

app.get('/logout', (req,res) => {
    req.session = null;   
	res.redirect('/');
});

app.get('/find', function(req,res) {
    handle_Find(res,req, req.query.docs);
});

app.post('/search', function(req,res) {
    var item ={};
    item[req.body.criteria] = req.body.c_name;
    handle_Find(res,req, item);
});

app.get('/details', (req,res) => {
    handle_Details(res, req.query);
});

app.get('/map', (req,res) => {
    res.status(200).render('map',{
        lat:req.query.lat,
		lon:req.query.lon,
		zoom:req.query.zoom ? req.query.zoom : 15
    });
});

app.get('/create', (req, res) => {
    res.status(200).render('create');
});

app.post('/create', (req, res) => {
/*
    var item ={
        name: req.fields.name,
        borugh:"",
        cuisine: req.fields.cuisine,
        address:{street: req.fields.street,
            building: req.fields.building,
            zipcode: req.fields.zipcode,
            coord: `[${req.fields.lon},${req.fields.lat}]` },
        grades:{},
        owner:""
    };
*/
    var item = {}
    const form = new formidable.IncomingForm(); 
    form.parse(req, (err, fields, files) => {

        fs.readFile(files.sampleFile.path, (err,data) => {
            assert.equal(err,null);
            item['name'] = fields.name;
            item['borugh'] = "";
            item['cuisine'] = fields.cuisine;
            item['photo'] = new Buffer.from(data).toString('base64');
            item['photomimetype'] = files.sampleFile.type;
            item['address'] = {street: fields.street,
                building: fields.building,
                zipcode: fields.zipcode,
                coord: {lon: fields.lon,lat: fields.lat} };
            item['grades'] = [];
            item['owner'] = req.session.username;
            });

    });
    
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");

        const db = client.db(dbName);
        db.collection('restaurant').insertOne(item, (err) => {
            assert.equal(null, err);
            console.log('Inserted');
            client.close();
        });
    });

   res.status(200).render('create');
    
});

app.get('/edit', (req,res) => {
    handle_Edit(res,req, req.query);
});

app.get('/editerr', (req,res) => {
    res.status(200).render('editerr');;
});

app.post('/edit', (req,res) => { 
    handle_Update(req, res);
});

app.get('/remove', (req,res) => {
    handle_Delete(res,req, req.query);
});

app.get('/removeerr', (req,res) => {
    res.status(200).render('removeerr');
});

app.get('/rate', (req,res) => {
    res.status(200).render('rate');
});

app.post('/rate', (req,res) => {
    score_Update(req,res);
});

app.get('/ratesuc', (req,res) => {
    res.status(200).render('ratesuc');;
});

app.get('/api/restaurant/name/:name', (req,res) => {
    if (req.params.name) {
        let criteria = {};
        criteria['name'] = req.params.name;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing bookingid"});
    }
});

app.get('/api/restaurant/borough/:borough', (req,res) => {
    if (req.params.borough) {
        let criteria = {};
        criteria['borough'] = req.params.borough;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing bookingid"});
    }
});

app.get('/api/restaurant/cuisine/:cuisine', (req,res) => {
    if (req.params.cuisine) {
        let criteria = {};
        criteria['cuisine'] = req.params.cuisine;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing bookingid"});
    }
});

app.get('/*', (req,res) => {
    res.status(404).render('info', {message: `${req.path} - Unknown request!` });
})

app.listen(app.listen(process.env.post || 8099));
