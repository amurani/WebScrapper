var express = require("express");
var fs = require("fs");
var request = require("request");
var cheerio = require("cheerio");

var app = express();

//var base_url = 'http://localhost:8080';
var base_url = 'http://scrapper.ap01.aws.af.cm/';

var start = 1;
var finish = 288;
var page = start;
var skipped = [];

function isArticle(article) {
	var articles = fs.readdirSync('articles');
	for (var article in articles) {
		var name = articles[article].replace('.json', '');
		if (page == name)
			return true;
	}
	return false;
}

function readArticle(page, callback) {
	fs.readFile('articles/' + page + '.json', 'utf-8', function(err, file) {
		var json = '';
		if (err)
			json = 'Sorry. Could not fetch article. ' + err;
		else
			json = file;
		if (callback)
			callback(json);
	});
}

function fetchArticles() {
	if (page > finish)
		return;
	else if (!isArticle(page)) {
		buildArticle(page);
		page = page + 1;
		setTimeout(fetchArticles, 2500);
	}
}

function buildArticle(page, callback) {
	var url = "http://www.strathmore.edu/en/media-center/" + page;
	request(url, function(err, response, html) {
		if (!err) {
			// This is where we'll put it all
			var json = { date : "", title : "", img : "", caption : "", content : "" };
			var date, title, img, caption, content;

			// Lets parse the DOM
			var $ = cheerio.load(html);
			var canSave = true;
			$('#maincontentcol1').filter(function() {
				var article = $(this);
				if (article.children().length > 1)  {
					date = article.children('.newsdetaildate').html();
					title = article.children('.newsdetailtitle').html();
					img = article.children('.newsdetailcontent').children('figure').children('img').attr('src');
					caption = article.children('.newsdetailcontent').children('figure').children('figcaption').html();
					content = article.children('.newsdetailcontent');
					content.children('figure').remove();
					content = content.html();

					json.date = (date != null) ? date.trim() : 'Could not fetch date.';
					json.title = (title != null) ? title : 'Could not fetch title.';
					json.img = (img != null) ? img : 'Could not fetch image.';
					json.caption = (caption != null) ? caption : 'Could not fetch caption.';
					json.content = (content != null) ? content.trim(): 'Could not fetch content.';
				} else {
					canSave = false;
					console.log('Error reading article.');
				}
			});

			// Lets save our json into a file
			if (canSave) {
				fs.writeFile('articles/' + page + '.json', JSON.stringify(json, null, 4), function(err) {
					if (err)
						console.log('' + err + ' ecountered while saving article.');
					else {
						console.log('Article saved.');
						if (callback)
							callback.call();
					}
				});
			} else
				console.log('Could not find article.');
		} else
			skipped.push(page);
	});
}

function serveHtml(res, title, content) {
	res.writeHead(200, { 'Content-Type' : 'text/html', 'Access-Control-Allow-Origin' : '*' });
	var html = '<!doctype html>' +
				'<html>' +
					'<head>' +
						'<title>' + title + '</title>' +
					'</head>' +
					'<body>' + content + '</body>' +
				'</html>';
	res.write(html);
	res.end();
}

function serveArticle(res, json) {
	res.writeHead(200, { 'Content-Type' : 'text/json', 'Access-Control-Allow-Origin' : '*' });
	res.write(json);
	res.end();
}

app.get('/', function(req, res) {
	var content = '';
	var articles = fs.readdirSync('articles');
	for (var article in articles) {
		var name = articles[article].replace('.json', '');
		content += 	'<li><a href="' + base_url + '/article/' + name + '">Article ' + name + '</a></li>';
	}
	content = (content.length > 0) ? content : '<li><b>No artilces have been saved yet.</b></li>';
	serveHtml(res, 'Articles', '<ul>' + content + '</ul>');
});

app.get('/article/:page', function(req, res) {
	readArticle(req.params.page, function(article) {
		serveArticle(res, article);
	});
});

app.get('/fetch/:page', function(req, res) {
	var page = req.params.page;
	if (!isArticle(page)) {
		buildArticle(page, function() {
			readArticle(page, function(article) {
				serveArticle(res, article);
			});
		});
	} else {
		readArticle(page, function(article) {
			serveArticle(res, article);
		});
	}
});

app.get('/update/:finish', function(req, res) {
	if (req.params.finish > start) {
		finish = req.params.finish;
		fetchArticles();
		if (skipped.length > 0) {
			var content = '<p>The following articles were skipped.</p><ul>';
			for (var page in skipped)
				content += '<li>' + skipped[page] + '</li>';
			content += '</ul>';
			serveHtml(res, 'Done Fetching', content);
		}
	}
});

//app.listen("8080");
app.listen(process.env.VMC_APP_PORT || 1337, null);
exports = module.exports = app;