var express = require('express');
const writeYamlFile = require('write-yaml-file')
const exec = require('await-exec')
const router = express.Router();
const sqlite3 = require('sqlite3');
const replaceInFile = require('replace-in-file');

router.post('/', async(req, res) => {
    const {nsname, cpu, mem, gpu, diskspace, teamname, requestBy} = req.body; // Get request payload into respective variables

    let code = 0; // Default code
    let msg = "Success"; // Default message

    let createdAt = new Date(); // Converting dates into the actual date format

    if (!checkValues(req.body, "nsname|cpu|mem|gpu|diskspace|teamname")) { // Check if any payload parameters are missing, and if it is throw an error, and quit.
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
    if (role_info[0].rolename !== 'it-admin' && role_info[0].rolename !== 'oredata-admin' && role_info[0].rolename !== 'team-lead') {
        return res.status(403).send({message: "Authorization has been failed."});
    }
    // Authorization End

    const team_info = await db_each("SELECT teamname, cpu, mem, gpu, diskspace FROM Teams WHERE teamname = '" + teamname + "'");
    if (team_info.length === 0) {
        return res.status(500).send({message: "Specified team doesn't exists."});
    }

    db.run("CREATE TABLE IF NOT EXISTS Namespaces (id INTEGER PRIMARY KEY, nsname TEXT, cpu TEXT, mem TEXT, gpu TEXT, diskspace TEXT, teamname TEXT)");
    // db.run("CREATE TABLE IF NOT EXISTS TeamNamespace (id INTEGER PRIMARY KEY, teamname TEXT, nsname TEXT)");

    const namespace_info = await db_each("SELECT nsname, cpu, mem, gpu, diskspace FROM Namespaces WHERE teamname = '" + teamname + "'");
    let cpuTotal = 0;
    let memTotal = 0;
    let gpuTotal = 0;
    let diskspaceTotal = 0;
    for (let item of namespace_info) {
        if (item.nsname === nsname) {
            return res.status(500).send({message: "Namsespace with same name already exists in the DB, not changing anything"});
        }
        cpuTotal += Number(item.cpu);
        memTotal += Number(item.mem);
        gpuTotal += Number(item.gpu);
        diskspaceTotal += Number(item.diskspace);
    }

    if (Number(team_info[0].cpu) < Number(cpuTotal) + Number(cpu)) {
        return res.status(500).send({message: "CPU limit exceeded. Available quota: " + String(Number(team_info[0].cpu) - Number(cpuTotal)) + " Requested CPU value: " + cpu});
    } else if (Number(team_info[0].mem) < Number(memTotal) + Number(mem)) {
        return res.status(500).send({message: "MEM limit exceeded. Available quota: " + String(Number(team_info[0].mem) - Number(memTotal)) + " Requested MEM value: " + mem});
    } else if (Number(team_info[0].gpu) < Number(gpuTotal) + Number(gpu)) {
        return res.status(500).send({message: "GPU limit exceeded. Available quota: " + String(Number(team_info[0].gpu) - Number(gpuTotal)) + " Requested GPU value: " + gpu});
    } else if (Number(team_info[0].diskspace) < Number(diskspaceTotal) + Number(diskspace)) {
        return res.status(500).send({message: "Disk Space limit exceeded. Available quota: " + String(Number(team_info[0].diskspace) - Number(diskspaceTotal)) + " Requested Disk Spcae value: " + diskspace});
    }

    const namespaceData = {
        apiVersion: "kubeflow.org/v1beta1",
        kind: "Profile",
        metadata: {
            name: nsname
        },
        spec: {
            owner: {
                kind: "User",
                name: "nobody"
            },
            resourceQuotaSpec: {
                hard: {
                    'cpu': String(cpu) + "m", // 1000m = 1 CPU
                    'memory': String(mem) + "Mi", // 1000Mi = 1GB MEM 
                    'nvidia.com/gpu': String(gpu),
                    'requests.storage': String(diskspace) + "Mi" // 1000Mi = 1GB Storage
                }
            }
        }
    }

    await writeYamlFile('./yaml-repo/kubeflow-namespace.yaml', namespaceData);

    await exec("cd yaml-repo && kubectl apply -f kubeflow-namespace.yaml", (error, stdout, stderr) => {
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

    db.run("INSERT INTO Namespaces (nsname, cpu, mem, gpu, diskspace, teamname) VALUES ('" + nsname + "', '" + cpu + "', '" + mem + "', '" + gpu + "', '" + diskspace + "', '" + teamname + "')");
    // db.run("INSERT INTO TeamNamespace (teamname, nsname) VALUES ('" + teamname + "', '" + nsname + "')");

    const options = {
        files: './yaml-repo/dex-yaml.yaml',
        from: /'/g,
        to: '',
    };

    await replaceInFile(options);

    async function db_each(query) {
        return new Promise(function(resolve, reject) {
            db.all(query, function(err, rows){
                if (err) { return reject(err); }
                resolve(rows);
            })
        })
    }

    return res.status(200).send({message: "User configuration has been generated and applied successfully"});

});

router.patch('/', async(req, res) => {
    const {nsname, cpu, mem, gpu, diskspace, teamname, requestBy} = req.body; // Get request payload into respective variables

    let code = 0; // Default code
    let msg = "Success"; // Default message

    let createdAt = new Date(); // Converting dates into the actual date format

    if (!checkValues(req.body, "nsname|cpu|mem|gpu|diskspace|teamname")) { // Check if any payload parameters are missing, and if it is throw an error, and quit.
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
    if (role_info[0].rolename !== 'it-admin' && role_info[0].rolename !== 'oredata-admin' && role_info[0].rolename !== 'team-lead') {
        return res.status(403).send({message: "Authorization has been failed."});
    }
    // Authorization End

    const team_info = await db_each("SELECT teamname, cpu, mem, gpu, diskspace FROM Teams WHERE teamname = '" + teamname + "'");
    if (team_info.length === 0) {
        return res.status(500).send({message: "Specified team doesn't exists."});
    }

    const ns_info = await db_each("SELECT nsname, cpu, mem, gpu, diskspace FROM Namespaces WHERE nsname = '" + nsname + "'");
    if (ns_info.length === 0) {
        return res.status(500).send({message: "Specified namespace doesn't exists."});
    }

    db.run("CREATE TABLE IF NOT EXISTS Namespaces (id INTEGER PRIMARY KEY, nsname TEXT, cpu TEXT, mem TEXT, gpu TEXT, diskspace TEXT, teamname TEXT)");
    // db.run("CREATE TABLE IF NOT EXISTS TeamNamespace (id INTEGER PRIMARY KEY, teamname TEXT, nsname TEXT)");

    const namespace_info = await db_each("SELECT nsname, cpu, mem, gpu, diskspace FROM Namespaces WHERE teamname = '" + teamname + "'");
    let cpuTotal = 0;
    let memTotal = 0;
    let gpuTotal = 0;
    let diskspaceTotal = 0;
    for (let item of namespace_info) {
        if (item.nsname === nsname) {
            continue; // so that we skip the current one, as we're going to add it from parameters
        }
        cpuTotal += Number(item.cpu);
        memTotal += Number(item.mem);
        gpuTotal += Number(item.gpu);
        diskspaceTotal += Number(item.diskspace);
    }

    if (Number(team_info[0].cpu) < Number(cpuTotal) + Number(cpu)) {
        return res.status(500).send({message: "CPU limit exceeded. Available quota: " + String(Number(team_info[0].cpu) - Number(cpuTotal)) + " Requested CPU value: " + cpu});
    } else if (Number(team_info[0].mem) < Number(memTotal) + Number(mem)) {
        return res.status(500).send({message: "MEM limit exceeded. Available quota: " + String(Number(team_info[0].mem) - Number(memTotal)) + " Requested MEM value: " + mem});
    } else if (Number(team_info[0].gpu) < Number(gpuTotal) + Number(gpu)) {
        return res.status(500).send({message: "GPU limit exceeded. Available quota: " + String(Number(team_info[0].gpu) - Number(gpuTotal)) + " Requested GPU value: " + gpu});
    } else if (Number(team_info[0].diskspace) < Number(diskspaceTotal) + Number(diskspace)) {
        return res.status(500).send({message: "Disk Space limit exceeded. Available quota: " + String(Number(team_info[0].diskspace) - Number(diskspaceTotal)) + " Requested Disk Spcae value: " + diskspace});
    }

    const namespaceData = {
        apiVersion: "kubeflow.org/v1beta1",
        kind: "Profile",
        metadata: {
            name: nsname
        },
        spec: {
            owner: {
                kind: "User",
                name: "nobody"
            },
            resourceQuotaSpec: {
                hard: {
                    'cpu': String(cpu) + "m", // 1000m = 1 CPU
                    'memory': String(mem) + "Mi", // 1000Mi = 1GB MEM 
                    'nvidia.com/gpu': String(gpu),
                    'requests.storage': String(diskspace) + "Mi" // 1000Mi = 1GB Storage
                }
            }
        }
    }

    await writeYamlFile('./yaml-repo/kubeflow-namespace.yaml', namespaceData);

    await exec("cd yaml-repo && kubectl apply -f kubeflow-namespace.yaml", (error, stdout, stderr) => {
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

    db.run("UPDATE Namespaces SET cpu = '" + cpu + "', mem = '" + mem + "', gpu = '" + gpu + "', diskspace = '" + diskspace + "' WHERE nsname = '", nsname + "'");

    const options = {
        files: './yaml-repo/dex-yaml.yaml',
        from: /'/g,
        to: '',
    };

    await replaceInFile(options);

    async function db_each(query) {
        return new Promise(function(resolve, reject) {
            db.all(query, function(err, rows){
                if (err) { return reject(err); }
                resolve(rows);
            })
        })
    }

    return res.status(200).send({message: "User configuration has been generated and applied successfully"});

});

router.get('/:nsname?/:teamname?', async(req, res) => {

    const nsname = req.params.nsname;
    const teamname = req.params.teamname;

    const db = new sqlite3.Database('test.db');
    if (nsname && teamname) {
        const ns_info = await db_each("SELECT nsname, cpu, mem, gpu, diskspace, teamname FROM Namespaces WHERE nsname = '" + nsname + "' AND teamname = '" + teamname + "'");
        if (ns_info.length === 0) {
            return res.status(404).send({message: "Provided team name doesn't exists."})
        }
        return res.status(200).send({teams: ns_info});
    } else {
        const ns_info = await db_each("SELECT nsname, teamname, cpu, mem, gpu, diskspace, teamname FROM Namespaces");
        return res.status(200).send({teams: ns_info});
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
    // exec -> kubectl delete profiles <<namespace_name>> after deleting it from the DB
    // First check if the namespace that wants to be deleted exists or not
    // Add another check for team-namespace correlation. Because if a team-lead from a different team wants to delete an ns that doesn't belong, they shouldn't

    const {nsname, requestBy} = req.body;

    if (!checkValues(req.body, "nsname")) { // Check if any payload parameters are missing, and if it is throw an error, and quit.
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
    if (role_info[0].rolename !== 'it-admin' && role_info[0].rolename !== 'oredata-admin' && role_info[0].rolename !== 'team-lead') {
        return res.status(403).send({message: "Authorization has been failed."});
    }
    // Authorization End

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

    return res.status(200).send({message: "Namespace has been successfully removed from the table."});

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