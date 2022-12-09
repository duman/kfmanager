var express = require('express');
const exec = require('await-exec')
const router = express.Router();
const sqlite3 = require('sqlite3');

router.post('/', async(req, res) => {
    const {teamname, cpu, mem, gpu, diskspace, requestBy} = req.body; // Get request payload into respective variables

    let code = 0; // Default code
    let msg = "Success"; // Default message

    let createdAt = new Date(); // Converting dates into the actual date format

    if (!checkValues(req.body, "teamname|cpu|mem|gpu|diskspace")) { // Check if any payload parameters are missing, and if it is throw an error, and quit.
        code = 1;
        msg = "Missing JSON Body value(s).";
        let result = {
            code: code,
            msg: msg
        }
        return res.status(500).send(result);
    }

    // Authorization Start
    if (!requestBy) {
        return res.status(401).send({message: "Unauthorized request attempt."});
    }

    const db = new sqlite3.Database('test.db');
    const role_info = await db_each("SELECT username, rolename, description, allowedactions FROM UserRole WHERE username = '" + requestBy + "'");
    if (role_info.length === 0) {
        return res.status(404).send({message: "Request owner can't be found."});
    }
    if (role_info[0].rolename !== 'it-admin' && role_info[0].rolename !== 'oredata-admin') {
        return res.status(403).send({message: "Authorization has been failed."});
    }
    // Authorization End

    db.run("CREATE TABLE IF NOT EXISTS Teams (id INTEGER PRIMARY KEY, teamname TEXT, cpu TEXT, mem TEXT, gpu TEXT, diskspace TEXT)");

    const team_info = await db_each("SELECT teamname, cpu, mem, gpu, diskspace FROM Teams");
    for (let item of team_info) {
        if (item.teamname === teamname) {
            return res.status(500).send({message: "Team already exists in the DB, not changing anything"});
        }
    }

    db.run("INSERT INTO Teams (teamname, cpu, mem, gpu, diskspace) VALUES ('" + teamname + "', '" + cpu + "', '" + mem + "', '" + gpu + "', '" + diskspace + "')");

    async function db_each(query) {
        return new Promise(function(resolve, reject) {
            db.all(query, function(err, rows){
                if (err) { return reject(err); }
                resolve(rows);
            })
        })
    }

    return res.status(200).send({message: "Team has been created successfully"});

});

router.patch('/', async(req, res) => {
    const {teamname, cpu, mem, gpu, diskspace, requestBy} = req.body; // Get request payload into respective variables

    let code = 0; // Default code
    let msg = "Success"; // Default message

    let createdAt = new Date(); // Converting dates into the actual date format

    if (!checkValues(req.body, "teamname|cpu|mem|gpu|diskspace")) { // Check if any payload parameters are missing, and if it is throw an error, and quit.
        code = 1;
        msg = "Missing JSON Body value(s).";
        let result = {
            code: code,
            msg: msg
        }
        return res.status(500).send(result);
    }

    // Authorization Start
    if (!requestBy) {
        return res.status(401).send({message: "Unauthorized request attempt."});
    }

    const db = new sqlite3.Database('test.db');
    const role_info = await db_each("SELECT username, rolename, description, allowedactions FROM UserRole WHERE username = '" + requestBy + "'");
    if (role_info.length === 0) {
        return res.status(404).send({message: "Request owner can't be found."});
    }
    if (role_info[0].rolename !== 'it-admin' && role_info[0].rolename !== 'oredata-admin') {
        return res.status(403).send({message: "Authorization has been failed."});
    }
    // Authorization End

    db.run("CREATE TABLE IF NOT EXISTS Teams (id INTEGER PRIMARY KEY, teamname TEXT, cpu TEXT, mem TEXT, gpu TEXT, diskspace TEXT)");

    const team_info = await db_each("SELECT teamname, cpu, mem, gpu, diskspace FROM Teams WHERE teamname = '" + teamname + "'");
    if (team_info.length === 0) {
        return res.status(500).send({message: "Team cannot be found."});
    }

    db.run("UPDATE Teams SET cpu = '" + cpu + "', mem = '" + mem + "', gpu = '" + gpu + "', diskspace = '" + diskspace + "' WHERE teamname = '" + teamname + "'");

    async function db_each(query) {
        return new Promise(function(resolve, reject) {
            db.all(query, function(err, rows){
                if (err) { return reject(err); }
                resolve(rows);
            })
        })
    }

    return res.status(200).send({message: "Team has been updated successfully"});

});

router.get('/:teamname?', async(req, res) => {

    const teamname = req.params.teamname;

    const db = new sqlite3.Database('test.db');
    if (teamname) {
        const team_info = await db_each("SELECT teamname, cpu, mem, gpu, diskspace FROM Teams WHERE teamname = '" + teamname + "'");
        if (team_info.length === 0) {
            return res.status(404).send({message: "Provided team name doesn't exists."})
        }
        return res.status(200).send({teams: team_info});
    } else {
        const team_info = await db_each("SELECT teamname, cpu, mem, gpu, diskspace FROM Teams");
        return res.status(200).send({teams: team_info});
    }

    async function db_each(query) {
        return new Promise(function(resolve, reject) {
            db.all(query, function(err, rows){
                if (err) { return reject(err); }
                resolve(rows);
            })
        })
    }
});

router.delete('/', async(req, res) => {

    const {teamname, requestBy} = req.body;

    if (!checkValues(req.body, "teamname")) { // Check if any payload parameters are missing, and if it is throw an error, and quit.
        code = 1;
        msg = "Missing JSON Body value(s).";
        let result = {
            code: code,
            msg: msg
        }
        return res.status(500).send(result);
    }

    // Authorization Start
    if (!requestBy) {
        return res.status(401).send({message: "Unauthorized request attempt."});
    }

    const db = new sqlite3.Database('test.db');
    const role_info = await db_each("SELECT username, rolename, description, allowedactions FROM UserRole WHERE username = '" + requestBy + "'");
    if (role_info.length === 0) {
        return res.status(404).send({message: "Request owner can't be found."});
    }
    if (role_info[0].rolename !== 'it-admin' && role_info[0].rolename !== 'oredata-admin') {
        return res.status(403).send({message: "Authorization has been failed."});
    }
    // Authorization End

    await db_each("DELETE FROM Teams WHERE teamname = '" + teamname + "'");
    const ns_info = await db_each("SELECT nsname, cpu, mem, gpu, diskspace, teamname FROM Namespaces WHERE teamname = '" + teamname + "'");
    for (item of ns_info) {
        let nsname = item.nsname;
        await db_each("DELETE FROM Namespaces WHERE nsname = '" + nsname + "'");
        await exec("kubectl delete profiles " + nsname, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        });
    }

    return res.status(200).send({message: "Team has been successfully removed from the table."});

    async function db_each(query) {
        return new Promise(function(resolve, reject) {
            db.all(query, function(err, rows){
                if (err) { return reject(err); }
                resolve(rows);
            })
        })
    }
});

function checkValues(obj, list) {
    if (typeof list === "string") {
        list = list.split("|");
    }
    for (prop of list) {
        let val = obj[prop];
        if (val === null || val === undefined) {
            return false;
        }
    }
    return true;
}

module.exports = router;