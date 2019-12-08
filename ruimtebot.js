process.chdir(__dirname);
debug={writeFile:false,consoleLog:false}
requestDefault=require('request')
request=requestDefault.defaults({
	jar: requestDefault.jar(),
	headers:{
		"User-Agent":"Mozilla (github.com/RubenNL)"
	}
})
$=require('cheerio')
moment=require('moment')
moment.locale('nl-NL')
http=require('http')
fs=require('fs')
config=JSON.parse(fs.readFileSync('config.json'))
botToken=config.botToken
webhook=config.webhook
listenPort=config.listenPort
botName=''
startTimes=["8:00","8:30","9:00","9:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30"]
endTimes=["8:30","9:00","9:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00"]
telegramOptions={}
personenList=[1,3,5,8,10,15,20,25,30]
working=false
function sendRequest(form,lokalen,personenId,telegramArguments,callback) {
	try {
		startTijd=telegramArguments.startTijd
		eindTijd=telegramArguments.eindTijd
		size=telegramArguments.size
		datum=telegramArguments.datum
	} catch(e) {
		if(debug.consoleLog) console.log('got a request from before restart...',e)
		return
	}
	if(form) {
		options={
			url:"https://www.ruimtereserveren.hu.nl/Scientia/Portal/Login.aspx?ReturnUrl=Forward.aspx%3fSdbName%3dHeidelberglaan_B%26ApplicationName%3dWRB",
			method: "POST",
			form:form,
			followAllRedirects:true
		}
	} else {
		options={
			url:"https://www.ruimtereserveren.hu.nl/1920/Heidelberglaan_B/default.aspx"
		}
	}
	request(options,function(err,res,body) {
		if(debug.writeFile) fs.writeFileSync('login.html',body,'utf8')
		body=$.load(body)
		if(body('#errorMsg').text()=="Invalid User name or password. Please try again") {
			callback({error:{message:"Gebruikersnaam/wachtwoord lijkt niet te kloppen"}})
			return
		}
		form={}
		body('form').find('input[type="hidden"]').each(function(key,item) {
			item=$(item)
			form[item.attr('name')]=item.attr('value')
		})
		start=startTimes.indexOf(startTijd)
		end=endTimes.indexOf(eindTijd)
		duration=end-start+1
		dagen=moment.duration(datum.diff(moment('1-1-2000','D-M-YYYY'))).asDays()
		form['ctl00$Main$Time1$StartTimeList']=start.toString()
		form['ctl00$Main$Time1$EndTimeList']=end.toString()
		form['ctl00$Main$Time1$DurList']=duration.toString()
		form['ctl00$Main$Date1$CollegeCalendar1$MonthsNavigation']=datum.format('1-M-YYYY 00:00:00')
		form['ctl00$Main$Date1$CollegeCalendar1$calendarDateTextBox']=''
		personen=personenList[personenId]
		if(debug.consoleLog) console.log(personenId,personen)
		form['ctl00$Main$Room1$ReqSize']=personen

		form['ctl00$Main$ScriptManager1']="ctl00$Main$UpdatePanel2|ctl00$Main$Date1$CollegeCalendar1$theCalendar"
		form['__EVENTTARGET']='ctl00$Main$Date1$CollegeCalendar1$theCalendar'
		form['']=''
		form['ctl00$Main$Room1$ZoneList']='*'
		form['__SCROLLPOSITIONY']="0"
		form['__SCROLLPOSITIONX']="0"
		form['__LASTFOCUS']=''
		form['__EVENTARGUMENT']=Math.floor(dagen).toString()
		if(debug.consoleLog) console.log(73,form)
		request.post('https://www.ruimtereserveren.hu.nl/1920/Heidelberglaan_B/Book.aspx',{
			form:form,
			headers: {
				"X-MicrosoftAjax":"Delta=true",
				"X-Requested-With":"XMLHttpRequest",
				Origin:"https://www.ruimtereserveren.hu.nl",
				Referer:"https://www.ruimtereserveren.hu.nl/Heidelberglaan_B/default.aspx"
			}
		},function(err,res,body) {
			if(debug.writeFile) fs.writeFileSync('xhr.html',body,'utf8')
			form['ctl00$Main$Date1$CollegeCalendar1$calendarDateTextBox']=datum.format('D-M-YYYY+00:00:00')
			form['ctl00$Main$Date1$CollegeCalendar1$MonthsNavigation']=datum.format('1-M-YYYY 00:00:00')
			delete form['ctl00$Main$ScriptManager1']
			form["ctl00$Main$ShowOptionsBtn"]="Volgende+>"
			form['__EVENTTARGET']=''
			form['__EVENTARGUMENT']=''
			form['__SCROLLPOSITIONY']=142
			delete form['']
			parts=body.split('|')
			selection=["__VIEWSTATE","__EVENTVALIDATION"]
			parts.forEach(function (part,id) {
				if(selection.indexOf(part)>-1) form[part]=parts[id+1]
			})
			request.post('https://www.ruimtereserveren.hu.nl/1920/Heidelberglaan_B/Book.aspx',{
				form:form,
				headers: {
					Origin:"https://www.ruimtereserveren.hu.nl",
					Referer:"https://www.ruimtereserveren.hu.nl/Heidelberglaan_B/default.aspx"
				}
			},function(err,res,body) {
				if(debug.writeFile) fs.writeFileSync('book.html',body,'utf8')
				body=$.load(body)
				body('tr').each(function(id,line) {
					line=$(line)
					if(line.attr('class')=="GridHeader") return
					if(!line.attr('class')) return
					lokalen[line.find('.OptionLocationNameColumn').text().split(' ')[0]]={
						personen:line.find('.OptionCapacityColumn').text(),
						beschrijving:line.find('.OptionLocationDescriptionColumn').text()
					}
				})
				if(debug.consoleLog) console.log(personenId,lokalen)
				personenId++
				if(personenId==personenList.length) {
					callback(lokalen)
					return
				}
				sendRequest(false,lokalen,personenId,telegramArguments,callback)
			})
		})
	})
}
function aanvraag(options,callback) {
	if(!working) {
		username=options.username
		password=options.password
		working=true
		request('https://www.ruimtereserveren.hu.nl/Scientia/Portal/Login.aspx?ReturnUrl=Forward.aspx%3fSdbName%3dHeidelberglaan_B%26ApplicationName%3dWRB',function(err,res,body) {
			body=$.load(body)
			form={}
			body('form').find('input[type="hidden"]').each(function(key,item) {
				item=$(item)
				form[item.attr('name')]=item.attr('value')
			})
			form['ctl00$ContentPlaceHolder1$user']=username
			form['ctl00$ContentPlaceHolder1$password']=password
			form['ctl00$ContentPlaceHolder1$logon']="logon"
			personenId=personenList.indexOf(parseInt(options.size))
			sendRequest(form,{},personenId,options,function (lokalen) {
				working=false
				if(debug.consoleLog) console.log("end:",lokalen)
				if(debug.writeFile) fs.writeFileSync('lokalen.json',JSON.stringify(lokalen,null,2))
				callback(lokalen)
			})
		})
		return true
	}
}
function chunk(arr, chunkSize) {
	var R = [];
	for (var i=0,len=arr.length; i<len; i+=chunkSize)
		R.push(arr.slice(i,i+chunkSize));
	return R;
}
function keyboardRequest(text,options,size) {
	if(!size) size=4
	keyboard=chunk(options,size)
	if(debug.consoleLog) console.log(keyboard)
	return JSON.stringify({
		method:'sendMessage',
		chat_id:data.message.chat.id,
		text:text,
		reply_markup:JSON.stringify({
			one_time_keyboard:true,
			inline_keyboard:keyboard
		})
	})
}
function reserveLokaal(telegramArguments,callback) {
	try {
		startTijd=telegramArguments.startTijd
		eindTijd=telegramArguments.eindTijd
		size=telegramArguments.size
		datum=telegramArguments.datum
		lokaal=telegramArguments.lokaal
		username=telegramArguments.username
		password=telegramArguments.password
	} catch(e) {
		if(debug.consoleLog) console.log('got a request from before restart...',e)
		return
	}
	while(personenList.indexOf(size)==-1) {
		size--
		if(size==0) {
			console.log('size is 0?')
			return false
		}
	}
	if(!working) {
		working=true
		request('https://www.ruimtereserveren.hu.nl/Scientia/Portal/Login.aspx?ReturnUrl=Forward.aspx%3fSdbName%3dHeidelberglaan_B%26ApplicationName%3dWRB',function(err,res,body) {
			body=$.load(body)
			form={}
			body('form').find('input[type="hidden"]').each(function(key,item) {
				item=$(item)
				form[item.attr('name')]=item.attr('value')
			})
			form['ctl00$ContentPlaceHolder1$user']=username
			form['ctl00$ContentPlaceHolder1$password']=password
			form['ctl00$ContentPlaceHolder1$logon']="logon"
			request.post('https://www.ruimtereserveren.hu.nl/Scientia/Portal/Login.aspx?ReturnUrl=Forward.aspx%3fSdbName%3dHeidelberglaan_B%26ApplicationName%3dWRB',{form:form, followAllRedirects:true}, function(err,res,body) {
				if(debug.writeFile) fs.writeFileSync('login.html',body,'utf8')
				form={}
				body=$.load(body)
				body('form').find('input[type="hidden"]').each(function(key,item) {
					item=$(item)
					form[item.attr('name')]=item.attr('value')
				})
				body('select[name="ctl00$Main$Room1$ZoneList"]').find('option').each(function(id,item) {
					if($(item).text()==lokaal.split('-')[0]) form['ctl00$Main$Room1$ZoneList']=$(item).attr('value')
				})
				start=startTimes.indexOf(startTijd)
				end=endTimes.indexOf(eindTijd)
				duration=end-start+1
				dagen=moment.duration(datum.diff(moment('1-1-2000','D-M-YYYY'))).asDays()
				form['ctl00$Main$Time1$StartTimeList']=start.toString()
				form['ctl00$Main$Time1$EndTimeList']=end.toString()
				form['ctl00$Main$Time1$DurList']=duration.toString()
				form['ctl00$Main$Date1$CollegeCalendar1$MonthsNavigation']=datum.format('1-M-YYYY 00:00:00')
				form['ctl00$Main$Room1$ReqSize']=size
				form['ctl00$Main$ScriptManager1']="ctl00$Main$UpdatePanel1|ctl00$Main$Room1$KnownRoomBtn"
				form['__EVENTTARGET']='ctl00$Main$Room1$KnownRoomBtn'
				form['ctl00$Main$Date1$CollegeCalendar1$calendarDateTextBox']=''
				form['']=''
				form['__ASYNCPOST']='true'
				form['__EVENTARGUMENT']=""
				if(debug.consoleLog) console.log(form)
				request.post('https://www.ruimtereserveren.hu.nl/1920/Heidelberglaan_B/Book.aspx',{
					form:form,
					headers: {
						"X-MicrosoftAjax":"Delta=true",
						"X-Requested-With":"XMLHttpRequest",
						Origin:"https://www.ruimtereserveren.hu.nl",
						Referer:"https://www.ruimtereserveren.hu.nl/Heidelberglaan_B/default.aspx"
					}
				},function(err,res,body) {
					if(debug.writeFile) fs.writeFileSync('lokaalList.html',body,'utf8')
					selection=["__VIEWSTATE","__EVENTVALIDATION"]
					parts=body.split('|')
					parts.forEach(function (part,id) {
						if(selection.indexOf(part)>-1) form[part]=parts[id+1]
						if(part=="ctl00_Main_UpdatePanel1") body=$.load(parts[id+1])
					})
					body('.GridItem,.GridAlternateItem').each(function(key,item) {
						item=$(item)
						if(item.text().indexOf(lokaal)>-1) {
							form[item.find('input').attr('name')]="on"
						}
					})
					if(debug.consoleLog) console.log(form)
					form['ctl00$Main$ScriptManager1']="ctl00$Main$UpdatePanel2|ctl00$Main$Date1$CollegeCalendar1$theCalendar"
					form['__EVENTTARGET']='ctl00$Main$Date1$CollegeCalendar1$theCalendar'
					form['__EVENTARGUMENT']=Math.floor(dagen).toString()
					form['ctl00$Main$Date1$CollegeCalendar1$calendarDateTextBox']=''
					request.post('https://www.ruimtereserveren.hu.nl/1920/Heidelberglaan_B/Book.aspx',{
						form:form,
						headers: {
							"X-MicrosoftAjax":"Delta=true",
							"X-Requested-With":"XMLHttpRequest",
							Origin:"https://www.ruimtereserveren.hu.nl",
							Referer:"https://www.ruimtereserveren.hu.nl/Heidelberglaan_B/default.aspx"
						}
					},function(err,res,body) {
						if(debug.writeFile) fs.writeFileSync('xhr.html',body,'utf8')
						form['ctl00$Main$Date1$CollegeCalendar1$calendarDateTextBox']=datum.format('D-M-YYYY+00:00:00')
						form['ctl00$Main$Date1$CollegeCalendar1$MonthsNavigation']=datum.format('1-M-YYYY 00:00:00')
						delete form['ctl00$Main$ScriptManager1']
						form["ctl00$Main$ShowOptionsBtn"]="Volgende+>"
						form['__EVENTTARGET']=''
						form['__EVENTARGUMENT']=''
						form['__SCROLLPOSITIONY']=142
						delete form['__ASYNCPOST']
						delete form['']
						parts=body.split('|')
						selection=["__VIEWSTATE","__EVENTVALIDATION"]
						parts.forEach(function (part,id) {
							if(selection.indexOf(part)>-1) form[part]=parts[id+1]
						})
						request.post('https://www.ruimtereserveren.hu.nl/1920/Heidelberglaan_B/Book.aspx',{
							form:form,
							headers: {
								Origin:"https://www.ruimtereserveren.hu.nl",
								Referer:"https://www.ruimtereserveren.hu.nl/Heidelberglaan_B/default.aspx"
							}
						},function(err,res,body) {
							if(debug.writeFile) fs.writeFileSync('book.html',body,'utf8')
							body=$.load(body)
							form={}
							body('form').find('input[type="hidden"]').each(function(key,item) {
								item=$(item)
								form[item.attr('name')]=item.attr('value')
							})
							line=body('tr[class="GridItem"]')
							id=line.find('input[type="radio"]').attr('value')
							form['Select+option']=id
							form['ctl00$Main$OptionSelector$SelectedItem']=id
							form['ctl00$Main$OptionSelector$MultipleSelect']="false"
							form['ctl00$Main$OptionSelector$ItemsCount']="1"
							form['ctl00$Main$OptionSelector$ErrorMessage']="You+have+reached+the+maximum+location+booking+limit"
							form['ctl00$Main$SelectOptionButton']="Volgende+>"
							delete form['__LASTFOCUS']
							if(debug.consoleLog) console.log(form)
							request.post('https://www.ruimtereserveren.hu.nl/1920/Heidelberglaan_B/Book.aspx',{
								form:form,
								headers: {
									Origin:"https://www.ruimtereserveren.hu.nl",
									Referer:"https://www.ruimtereserveren.hu.nl/Heidelberglaan_B/book.aspx"
								}
							},function (err,res,body) {
								if(debug.writeFile) fs.writeFileSync('gegevens.html',body,'utf8')
								body=$.load(body)
								form={}
								body('form').find('input[type="hidden"]').each(function(key,item) {
									item=$(item)
									form[item.attr('name')]=item.attr('value')
								})
								form['ctl00$Main$BookingForm1$tel']=''
								form['ctl00$Main$BookingForm1$otherInf']="lokalenbot Deze reservering is gemaakt via t.me/"+botName
								form['__EVENTTARGET']="ctl00$Main$MakeBookingBtn"
								request.post('https://www.ruimtereserveren.hu.nl/1920/Heidelberglaan_B/Book.aspx',{
									form:form,
									headers: {
										Origin:"https://www.ruimtereserveren.hu.nl",
										Referer:"https://www.ruimtereserveren.hu.nl/Heidelberglaan_B/book.aspx"
									}
								},function(err,res,body) {
									working=false
									if(debug.writeFile) fs.writeFileSync('done.html',body,'utf8')
									body=$.load(body)
									callback(body('#ctl00_Main_BookingForm1_BookingCompleted').text())
								})
							})
						})
					})
				})
			})
		})
		return true
	}
}
function sendBotRequest(method,params,callback) {
	request.post('https://api.telegram.org/bot'+botToken+'/'+method,{form:params},function(err,res,body) {
		if(debug.consoleLog) console.log(err,body)
		if(callback) {callback(JSON.parse(body))}
	})
}
http.createServer(function (req,res) {
	json=''
	req.on('data',function (chunk) {
		json+=chunk
	})
	req.on('end',function () {
		data=JSON.parse(json)
		if(debug.consoleLog) console.dir(data,{depth:null})
		res.writeHead(200,{'Content-Type': 'application/json'})
		if(data.callback_query) {
			sendBotRequest('answerCallbackQuery',{callback_query_id:data.callback_query.id})
			data.message={from:data.callback_query.from,chat:data.callback_query.message.chat}
			if(!telegramOptions[data.message.from.id]) {
				res.end(JSON.stringify({method:"sendMessage",chat_id:data.message.chat.id,text:'Sorry, er is iets mis gegaan. begin opnieuw.'}))
				return
			}
			message=data.callback_query.data
			parts=message.split(':')
			part=parts.shift()
			message=parts.join(':')
			if(part=="dag") {
				telegramOptions[data.message.from.id].datum=moment(message,'do D-M','nl').add(5,'hours')
				text='Kies een starttijd:'
				options=startTimes.map(function (text){return {text:text,callback_data:'start:'+text}})
				res.end(keyboardRequest(text,options))
			} else if(part=="start") {
				telegramOptions[data.message.from.id].startTijd=message
				text='Kies een eindtijd:'
				start=endTimes.indexOf(message)+1
				options=endTimes.slice(start,start+8).map(function (text){return {text:text,callback_data:"eind:"+text}})
				res.end(keyboardRequest(text,options))
			} else if(part=="eind") {
				telegramOptions[data.message.from.id].eindTijd=message
				text='kies een aantal personen:'
				options=personenList.map(function (personen) {return {text:personen,callback_data:"pers:"+personen}})
				res.end(keyboardRequest(text,options))
			} else if(part=="pers") {
				telegramOptions[data.message.from.id].size=message
				options=telegramOptions[data.message.from.id]
				text="is dit correct?\nDatum:"+options.datum.format('dddd D MMMM YYYY')+'\nbegin:'+options.startTijd+'\neind:'+options.eindTijd+'\npersonen:'+options.size
				options=[{text:'ja',callback_data:'correct:ja'},{text:'nee',callback_data:'correct:nee'}]
				res.end(keyboardRequest(text,options))
			} else if(part=="correct") {
				options=telegramOptions[data.message.from.id]
				if(message=="ja") {
					sendBotRequest('sendChatAction',{chat_id:data.message.from.id,action:'typing'})
					if(!aanvraag(options,function(lokalen) {
						if(debug.consoleLog) console.log(lokalen)
						if(lokalen.error) {
							res.end(JSON.stringify({
								method:'sendMessage',
								chat_id:data.message.chat.id,
								text:"Er is een fout opgetreden, begin opnieuw.("+lokalen.error.message+')'
							}))
							return
						}
						text='Selecteer je lokaal:'
						options=[]
						Object.keys(lokalen).forEach(function(lokaal) {
							eigenschappen=lokalen[lokaal]
							options.push({text:lokaal+' ('+eigenschappen.personen+'p) '+eigenschappen.beschrijving+'\n',callback_data:'lokaal:'+lokaal})
						})
						res.end(keyboardRequest(text,options,1))
					})) {
						text="sorry, op dit moment is er iemand anders ook bezig met het ophalen van de lokalen. klik op ja om opnieuw te proberen."
						options=[{text:'ja',callback_data:'correct:ja'},{text:'nee',callback_data:'correct:nee'}]
						res.end(keyboardRequest(text,options))
					}
				} else {
					res.end(JSON.stringify({
						method:'sendMessage',
						chat_id:data.message.chat.id,
						text:"Oeps! probeer opnieuw. typ /start om opnieuw te beginnen. Als je denkt dat er een fout in de bot zit, laat het weten."
					}))
				}
			} else if(part=="lokaal") {
				telegramOptions[data.message.from.id].lokaal=message
				options=telegramOptions[data.message.from.id]
				text="Weet je zeker dat je deze ruimte wilt reserveren?\nDatum:"+options.datum.format('dddd D MMMM YYYY')+'\nbegin:'+options.startTijd+'\neind:'+options.eindTijd+'\npersonen:'+options.size+'\nruimte:'+options.lokaal
				options=[{text:'ja',callback_data:'reserveren:ja'},{text:'nee',callback_data:'reserveren:nee'}]
				res.end(keyboardRequest(text,options))
			} else if(part=="reserveren") {
				if(message=="ja") {
					sendBotRequest('sendChatAction',{chat_id:data.message.from.id,action:'typing'})
					if(!reserveLokaal(telegramOptions[data.message.from.id],function (response) {
						res.end(JSON.stringify({
							method:'sendMessage',
							chat_id:data.message.chat.id,
							text:"Dit was het antwoord van ruimtereserveren.hu.nl:"+response+'\n\n\n. Om te controleren of je reservering is gelukt, en/of anuleren van de reservering, ga naar https://www.ruimtereserveren.hu.nl/1920/Heidelberglaan_B/myBookings.aspx'
						}))
					})) {
						text="sorry, op dit moment is er iemand anders ook bezig met deze bot. klik op ja om opnieuw te proberen."
						options=[{text:'ja',callback_data:'reserveren:ja'},{text:'nee',callback_data:'reserveren:nee'}]
						res.end(keyboardRequest(text,options))
					}
				} else {
					res.end(JSON.stringify({
						method:'sendMessage',
						chat_id:data.message.chat.id,
						text:"Oeps! probeer opnieuw. typ /start om opnieuw te beginnen. Als je denkt dat er een fout in de bot zit, laat het weten."
					}))
				}
			}
		} else if(data.message.reply_to_message) {
			sendBotRequest('deleteMessage',{chat_id:data.message.chat.id,message_id:data.message.message_id})
			if(data.message.reply_to_message.text=='Voor het plaatsen van een reservering is er een gebruikersnaam/wachtwoord nodig. voer je gebruikersnaam in.') {
				telegramOptions[data.message.from.id]={username:data.message.text}
				res.end(JSON.stringify({
					method:"sendMessage",
					chat_id:data.message.chat.id,
					text:'Nu het wachtwoord',
					reply_markup:JSON.stringify({force_reply:true})
				}))
			} else if(data.message.reply_to_message.text=='Nu het wachtwoord') {
				if(!telegramOptions[data.message.from.id]) {
					res.end(JSON.stringify({method:"sendMessage",chat_id:data.message.chat.id,text:'Sorry, er is iets mis gegaan. begin opnieuw.'}))
					return
				}
				telegramOptions[data.message.from.id].password=data.message.text
				dagen=[]
				options=[]
				for(i=0;i<14;i++) {
					dagen.push(moment().add(i,'day'))
				}
				dagen=dagen.forEach(function (dag) {
					if(dag.format('d')==6||dag.format('d')==0) return
					dag=dag.format('dd D-M')
					options.push({text:dag,callback_data:"dag:"+dag})
				})
				if(debug.consoleLog) console.log(options)
				text="Dan nu, welke dag wil je reserveren?"
				res.end(keyboardRequest(text,options))
			}
		} else {
			res.end(JSON.stringify({
				method:"sendMessage",
				chat_id:data.message.chat.id,
				text:'Voor het plaatsen van een reservering is er een gebruikersnaam/wachtwoord nodig. voer je gebruikersnaam in.',
				reply_markup:JSON.stringify({force_reply:true})
			}))
		}
	})
}).listen(listenPort)
sendBotRequest('getMe',{},function(data) {
	if(data.ok) {
		botName=data.result.username
		sendBotRequest('setWebhook',{url:webhook},function (data) {
			if(data.ok) {
				console.log("https://t.me/"+botName+' is gestart op '+webhook)
			} else {
				console.log('Er was een fout bij het ophalen van de webhook:',data)
				process.exit()
			}
		})
	} else {
		console.log('pas de token in de config.json aan naar je eigen token.')
		process.exit()
	}
})