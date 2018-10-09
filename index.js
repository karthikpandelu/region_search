const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http').Server(app);
const Excel = require('exceljs');
const nanp = require('./nanp-script');
const upload = require('express-fileupload');
const io = require('socket.io')(http);
var ss = require('socket.io-stream');
var path = require('path');
const fs = require('fs');

app.use(upload());
nanp.readFile();
app.use(bodyParser.urlencoded({extended: false}));

//public folder for servng static files
app.use(express.static('public'));
//set view engine ejs
app.set('view engine', 'ejs');

//to handle get request to serve home page
app.get('/region', function(req, res){
    res.render('index', {message: ""});
});

//to handle file upload post request and process the file
app.post('/search', function(req, res){ 
    if(req.files.upfile){
        var file = req.files.upfile;
        var name = file.name;
        var mesg_err = "File should be of type 'file_name.xlsx'";
        var mesg_fail = "File upload failed! Try again";
        var mesg_select = "Please select a file (Ex: file_name.xlsx)";
        var last = name.slice(-5);

        //validating for .xlsx file
        if(last != ".xlsx"){
            res.render('index', {message: mesg_err});
        }
        //if .xlsx then upload and process
        else{
            var uploadpath = __dirname + '/uploads/' + name;
            file.mv(uploadpath,function(err){
                if(err){
                    console.log("File Upload Failed",name,err);
                    res.render('index', {message: mesg_fail});
                }
                else {
                    console.log("File Uploaded",name);
                    res.render('result');
                }
            });
            var array_num = [];
            var array_fname = [];
            var array_lname = [];
            var reg = [];
            var result = [];

            let input_filename = "./uploads/"+name;
            var workbook = new Excel.Workbook();
            workbook.xlsx.readFile(input_filename)
                .then(function(){
                    let worksheet_input = workbook.getWorksheet("Sheet1");
                    worksheet_input.eachRow(function(row, rowNum){
                        if(rowNum != 1){
                            //reading from uploaded file
                            let num = row.getCell(1).value;
                            let fname = row.getCell(2).value;
                            let lname = row.getCell(3).value;
                            array_num.push(num);
                            array_fname.push(fname);
                            array_lname.push(lname);
                        }
                        else{
                        }
                    });
                    //calling compareNumber(takes array of numbers as parameter) function to get region. 
                    reg = nanp.compareNumber(array_num);

                    for(let i=0; i<array_num.length; i++){
                        var obj = {
                            PhoneNumber: array_num[i],
                            FirstName: array_fname[i],
                            LastName: array_lname[i],
                            Region: reg[i]
                        }
                        //creating array of objects to write the data back to the file
                        result.push(obj);
                    }

                    //sending file to the client
                    io.sockets.on('connection', function(socket){
                        socket.emit('send data', result);
                    });                 

                    //writing the data back to the file
                    var workbook_write = new Excel.Workbook();
                    var sheetName = 'Sheet1';
                    var sheet = workbook_write.addWorksheet(sheetName);

                    sheet.columns = [{key: 'PhoneNumber', header: 'PhoneNumber', width: 15}, {key: 'FirstName', header: 'FirstName', width: 15}, {key: 'LastName', header: 'LastName', width: 15}, {key: 'Region', header: 'Region', width: 15}];
                    for(i in result){
                        sheet.addRow(result[i]);
                    }
                    workbook_write.xlsx.writeFile(input_filename)
                        .then(function(){
                            console.log("done");
                            
                            //to stream file to client
                            // io.of('/user').on('connection', function(socket) {
                            //     console.log("connection");
                            //     var stream = ss.createStream();
                            //     var filename = input_filename;
                            //     ss(socket).emit('file', stream, {name: filename});
                            //     fs.createReadStream(filename).pipe(stream);
                            // });
                        })
                }); 
        } 
    }
    else {
        res.render('index', {message: mesg_select});        
    };

    //to delete the used file from the server
    // var file_del = __dirname + '/uploads/' + req.files.upfile.name;
    // fs.unlink(file_del, function(err){
    //     console.log("deleting error");
    // });
});

http.listen((process.env.PORT || 5000), function(){
    console.log('Server started');
});