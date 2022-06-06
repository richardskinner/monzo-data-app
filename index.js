require('dotenv').config();
const express = require('express');
const request = require('request');
const accessTokenService = require('./services/accessTokenService');
const app = express();

const oauthDetails = {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    redirect_uri: 'http://localhost:3000/oauth/callback'
};

// Will be populated once received
let accessToken = null;

app.get('/', (req, res) => {
    accessTokenService(res, accessToken);
    const {client_id, redirect_uri} = oauthDetails;
    const monzoAuthUrl = 'https://auth.monzo.com';
    res.type('html');
    res.send(`
        <div>
            <h1>Hello</h1>
            <form action="${monzoAuthUrl}">
              <input type="hidden" name="client_id" value="${client_id}" />
              <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
              <input type="hidden" name="response_type" value="code" />
              <button>Sign in</button>
            </form>
        </div>
  `);
});

app.get('/oauth/callback', (req, res) => {
    accessTokenService(res, accessToken);
    const {client_id, client_secret, redirect_uri} = oauthDetails;
    const {code} = req.query;
    const monzoAuthUrl = `https://api.monzo.com/oauth2/token`;

    request.post({
        url: monzoAuthUrl,
        form: {
            grant_type: 'authorization_code',
            client_id,
            client_secret,
            redirect_uri,
            code
        }
    }, (err, response, body) => {
        accessToken = JSON.parse(body); // Populate accessToken variable with token response
        res.redirect('/accounts'); // Send user to their accounts
    });
});

app.get('/accounts', (req, res) => {
    const {token_type, access_token} = accessToken;
    const accountsUrl = 'https://api.monzo.com/accounts';
    request.get(accountsUrl, {
        headers: {
            Authorization: `${token_type} ${access_token}`
        }
    }, (req, response, body) => {
        res.type('html');
        if (response.statusCode === 403) {
            res.send(`Please open your monzo app and approve access to your data.`);
            return;
        }
        const {accounts} = JSON.parse(body);
        res.write('<h1>Accounts</h1>');
        res.write('<ul>');
        for (let account of accounts) {
            const {id, type, description} = account;
            res.write(`
                <li>
                  ${description}(<i>${type}</i>) - <a href="/transactions/${id}">View transaction history</a>
                </li>
            `);
        }
        res.end('</ul>');
    });
});

app.get('/transactions/:acc_id', (req, res) => {
    const {acc_id} = req.params;
    const {token_type, access_token} = accessToken;
    const transactionsUrl = `https://api.monzo.com/transactions?expand[]=merchant&account_id=${acc_id}&limit=30`;
    request.get(transactionsUrl, {
        headers: {
            Authorization: `${token_type} ${access_token}`
        }
    }, (req, response, body) => {
        const {transactions} = JSON.parse(body);

        res.type('html');
        res.write(`
          <h1>Transactions</h1>
          <table>
            <thead>
              <th>Description</th>
              <th>Amount</th>
              <th>Category</th>
            </thead>
            <tbody>
        `);

        for (let transaction of transactions) {
            const {
                description,
                amount,
                category
            } = transaction;

            res.write(`
                <tr>
                  <td>${description}</td>
                  <td>${(amount / 100).toFixed(2)}</td>
                  <td>${category}</td>
                </tr>
              `);
        }

        res.write('</tbody></table>');
        res.end('<br /><a href="/accounts">&lt; Back to accounts</a>');
    });
});

app.listen(3000);
