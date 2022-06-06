module.exports = function (res, accessToken) {
    if (accessToken !== null) {
        res.redirect('/accounts');
    }
}
