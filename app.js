const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');

app.use(cors({
    origin: '*'
}));

app.use(
    bodyParser.urlencoded({
        limit : '5mb',
        extended : false
    })
);

app.use(
    bodyParser.json({
        limit : '50mb'
    })
);

app.use(express.json());

// Route
const userRoute = require('./Routes/userRoute');
const teamRoute = require('./Routes/teamRoute');
const namespacesRoute = require('./Routes/namespaceRoute');
const roleRoute = require('./Routes/roleRoute');
const assignUserRoute = require('./Routes/assignUserRoute');
const healthRoute = require('./Routes/healthRoute');

// Path
app.use('/users', userRoute);
app.use('/teams', teamRoute);
app.use('/namespaces', namespacesRoute);
app.use('/roles', roleRoute);
app.use('/assign-user', assignUserRoute);
app.use('/health', healthRoute);

const PORT = 3032;
const HOST = '0.0.0.0';

module.exports = app;
app.listen(PORT, HOST, () => {
    console.log(`Running on ${HOST}:${PORT}`);
});