const { promiseImpl } = require("ejs");
var mysql = require("mysql");

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "00000000",
    database: "ovote",
    dateStrings: true,
});
con.on("error", function (err) {
    console.log(err);
});

module.exports = {
    // getter
    getVotes: () => {
        return new Promise(function (resolve, reject) {
            con.query("SELECT * FROM votes", function (error, results, fields) {
                if (error) {
                    console.log("in getVotes: " + error);
                    reject(error);
                }
                console.log(results);
                resolve(results);
            });
        });
    },
    getUsers: () => {
        return new Promise(function (resolve, reject) {
            con.query("SELECT * FROM users", function (error, results, fields) {
                if (error) {
                    console.log("in getUsers:" + error);
                    reject(error);
                }
                resolve(results);
            });
        });
    },
    getHistory: () => {
        return new Promise(function (resolve, reject) {
            con.query("SELECT * FROM history", function (error, results, fields) {
                if (error) {
                    console.log("in getHistory:" + error);
                    reject(error);
                }
                resolve(results);
            });
        });
    },

    // setter
    /* 
    vote param type = 
    {
        v_id : varchar(8),
        name : varchar(20), 
        description : text, 
        start : YYYY-MM-DD hh:mm:ss, 
        end : YYYY-MM-DD hh:mm:ss},
        ageLimit: int,
        sexLimit : varchar(8),              // "0"(all), "1"(male only), "2"(female only)
        contents : {}
    }
    */
    addVote: (vote) => {
        return new Promise(function (resolve, reject) {
            con.query("INSERT INTO votes SET ?", vote, function (error, results, fields) {
                if (error) {
                    console.log("in addvote1 : " + error.code);
                    reject(error);
                }
                resolve(results);
            });
        });
    },
    deleteVote: (v_id) => {
        return new Promise(function (resolve, reject) {
            con.query(
                "DELETE from votes where v_id = ?",
                [v_id],
                function (error, results, fields) {
                    if (error) {
                        console.log("in deletevote : " + error);
                        reject(error);
                    }
                    console.log(results);
                    resolve(results);
                }
            );
        });
    },
    // update vote. vote.content should be stringed json. use JSON.stringfy.() before using
    updateVote: (vote) => {
        return new Promise(function (resolve, reject) {
            con.query(
                "UPDATE votes SET name = ?, description = ?, start = ?, end = ?, sexLimit = ?, ageLimit = ?, contents = ? WHERE v_id = ?",
                [
                    vote.name,
                    vote.description,
                    vote.start,
                    vote.end,
                    vote.sexLimit,
                    vote.ageLimit,
                    vote.contents,
                    vote.v_id,
                ],
                function (error, results, fields) {
                    if (error) {
                        console.log("in deletevote : " + error);
                        reject(error);
                    }
                    console.log(results);
                    resolve(results);
                }
            );
        });
    },

    // add user
    addUsers: (name) => {
        return new Promise(function (resolve, reject) {
            con.query(
                "INSERT INTO users (name) VALUES (?)",
                [name],
                function (error, results, fields) {
                    if (error) {
                        console.log("in addUsers: " + error);
                        reject(error);
                    }
                    console.log(results);
                    resolve(results);
                }
            );
        });
    },
    // delete user
    deleteUsers: (name) => {
        return new Promise(function (resolve, reject) {
            con.query(
                "DELETE from users where name = ?",
                [name],
                function (error, results, fields) {
                    if (error) {
                        console.log("in deleteUsers: " + error);
                        reject(error);
                    }
                    console.log(results);
                    resolve(results);
                }
            );
        });
    },

    // addHistory
    addHistory: (his) => {
        return new Promise(function (resolve, reject) {
            con.query("INSERT INTO history SET ?", his, function (error, results, fields) {
                if (error) {
                    console.log("in addhistory: " + error);
                    reject(error);
                }
                console.log(results);
                resolve(results);
            });
        });
    },
};

// {
//     v_id: "0",
//     name: "제목0",
//     description: "",
//     start: "2022-05-1T06:00:00.000Z",
//     end: "2022-05-30T06:00:00.000Z",
//     ageLimit: 20,
//     sexLimit: "0",
//     contents: { 내용1: 0, 내용2: 0, 내용3: 0 },
// },
// {
//     v_id: "1",
//     name: "제목1",
//     description: "",
//     start: "2022-01-01 00:00:00",
//     end: "2022-12-31 00:00:00",
//     ageLimit: 20,
//     sexLimit: "1",
//     contents: { 내용1: 2, 내용2: 3, 내용3: 4 },
// },
// {
//     v_id: "2",
//     description: "",
//     name: "제목2",
//     start: "2022-01-01 00:00:00",
//     end: "2022-12-31 00:00:00",
//     ageLimit: 20,
//     sexLimit: "2",
//     contents: { 내용1: 3, 내용2: 3, 내용3: 4 },
// },
