var $ = jQuery.noConflict();
var app, me, friends, userID, accessToken;

// START ---------------------- facebook related code ----------------------------
// Initialize facebook App and Canvas page
FB.init({appId  : fbid, status : true, cookie : true, xfbml : true, frictionlessRequests : true});
FB.Canvas.setAutoGrow();
AppInit();    

// Ensure the user is logged into facebook
function AppInit(){
	FB.getLoginStatus(function(response){
		var status = response.status;
		if(status == 'not_authorized')
			top.location.href = oauth;
		else if(status == 'unknown')
			top.location.href = oauth;
		else if(status == 'connected'){
			// Navigate the user to within facebook
			//var url = top.location.href;
			//if(url.search(fbid) == -1)
				//top.location.href = 'https://www.facebook.com/' + fbid;
			userID     = response.authResponse.userID;
			accessToken= response.authResponse.accessToken;
			// Order of priority
			getRA();
			getSummary();
			getMe();
			getFriends();
		}
	});        
}
// Get app information    
function getApp(){
	if(app == null){
		FB.api('/' + fbid, function(response){
			if(!response && response.error)
				alert(response.error);
			else
				app = response;
		});
	}
	return app;
}    
// Get current facebook user
function getMe(){
	if(me == null){
		FB.api('/me', function(response){
			if(!response && response.error)
				alert(response.error);
			else
				me = response;
		});
	}
	return me;
}
// Get friend list
function getFriends(){
	if(friends == null){
		FB.api('/me/friends', function(response){
			if(!response && response.error)
				msg = response.error;
			else{
				msg = '';
				var numFriends = response.data.length;
				friends = [];
				for(var i=0; i<numFriends; i++){
					var friend = response.data[i];
					friends.push({value: friend.id, label:friend.name, icon:pic(friend.id, friend.name)});
				}
				// add the current user to the friends list too
				friends.push({value: me.id, label: me.name, icon:pic(me.id, me.name)});
			}
		});
	}
	return friends;
}
// END   ---------------------- facebook related code ----------------------------

// START ---------------------- Share Expenses release code ----------------------------
$(function(){
	$('#expensedt').datepicker();
});

// Get recent activity
function getRA(){
	ShareExpenses.getRecentActivity(userID, '', '', function(result,event){
		var Expenses = null;
		if(event.status){
			Expenses = result;
		}
		$('#activity').append(displayRecentActivities(Expenses));
	});
}
// Display recent activities in the page
function displayRecentActivities(Expenses){
	var item = '';
	// Loop through each expense and create the test data
	$.each(Expenses, function(index, value){
		item += formatExpense(value, 'block');
	});
	return item;
}
function formatExpense(expense, state){
	var members = expense.Expense_Details__r;
	var name = (expense.Paid_By__r.Facebook__c == userID) ? 'You' : expense.Paid_By__r.Name;
	// Header information
	var eachItem ='<div class="item bottom-border" style="display: ' + state + '; padding-bottom: 5px" id="' + expense.Id + '">';
	eachItem +=         '<h4 style="padding: 0px; margin-left: 0px; margin-top: 2px; margin-bottom: 2px">' + expense.Name + (name == 'You' ? '<a class="del" title="Delete this expense">x</a>' : '') + '</h4>';
	eachItem +=         '<div class="expensemembers">';
	eachItem +=         '<div style="margin-bottom: 5px;">' + name + ' paid ' + expense.Amount__c + ' on ' + new Date(expense.Date__c).toLocaleDateString() + '</div>';
	eachItem +=             '<img style="vertical-align: top;" height="50" width="50" src="' + pic(expense.Paid_By__r.Facebook__c) + '" title="' + expense.Paid_By__r.Name + '"/>';
	$.each(members, function(i, member){
		eachItem +=             '<img style="vertical-align: top; margin-left: 5px;" height="25" width="25" src="' + pic(member.Party__r.Facebook__c) + '" title="' + member.Party__r.Name + '"/>';
	});
	eachItem +=         '</div>';
	eachItem +=      '</div>';
	return eachItem;
}
// Get summary information to display on the sides
function getSummary(){
	ShareExpenses.getParties(userID, function(result,event){
		var full = result;
		// Split into two halves
		var east = [];
		var west = [];
		$.each(full, function(index,value){
			if(value.amount <= 0)
				west.push(value);
			else
				east.push(value);
		});
		// sort so the highest amount comes at the top
		east.sort(function(a,b){ return b.amount-a.amount; });
		west.sort(function(a,b){ return a.amount-b.amount; });
		// display
		$('#east ul').html('').hide();
		$('#west ul').html('').hide();
		
		$('#east').append(formatSummary(east));
		$('#west').append(formatSummary(west));
	});
}
function formatSummary(data){
	var contentHTML = '<ul class="summaryList">';
	$.each(data, function(index,value){
		// remove negative sign
		var amount = Math.abs(value.amount);
		contentHTML += '<li><img src="' + pic(value.id) + '" title="' + value.name + '"/>' + amount + '</li>';
	});
	contentHTML += '</ul>';
	return contentHTML;
}
		
// Show the add expense fields
$('#inputExpense').click(function(){ 
	// Set for initial load
	$('#whopaid img').attr('src', pic(me.id));
	$('#whopaid img').attr('id', me.id);
	$('#whopaid img').attr('title', me.name);
	// Get app information so it can be used while posting expenses to wall
	getApp();
	// Initialize friends
	// update auto complete data source
	// $('#search').autocomplete("option", { source: friends }); autoFocus: true,
	$('#search').autocomplete({
		minLength: 2,
		source: friends,		
		focus:  function(event,ui) { $('#search').val(ui.item.label); return false;},
		select: function(event,ui) {
			addFriend(ui.item.value, ui.item.label);
			$('#search').val('');
			return false;
		}
	})
	.data('autocomplete')._renderItem = function(ul,item) {
		return $('<li></li>')
			.data('item.autocomplete', item )
			.append("<a> <img height=25 weight=25 src='" + item.icon + "'/>" + item.label + "</a>")
			.appendTo(ul);
	};        
	// Clear only few fields
	$('#amount').val('');
	$('#expensedt').val('');
	$('#location').val('');
	// Show and hide relevant elements
	$(this).hide(); 
	$(this).siblings().slideDown('fast');
	$('#search').trigger('focus');
});
// Add friend to the list of shared friends
function addFriend(id, name){
	// Do not allow duplicates
	if($('#sharedwith img[id=' + id + ']').length == 0){
		name = name ? name : '';
		var tag = '<img id=' + id + ' src=' + pic(id) + ' title="' + name + '"></img>';
		$('#search').before(tag);
	}
}
// Save function
$('#exp-add button').click(function(){        
	// Validate that all the required fields are filled in
	if(validate()){
		// Comma separated list of friends
		var Friends = [];
		var Names = [];
		$("#sharedwith img").each(function(index){ 
			Friends.push($(this).attr('id'));
			Names.push($(this).attr('title'));
		});
		// Escape to class
		var WhoPaid = $('#whopaid img').attr('id');
		var WhoPaidName = $('#whopaid img').attr('title');
		ShareExpenses.saveExpense(Friends.join(), Names.join(), WhoPaid, WhoPaidName,
							$('#location').val(),
							$('#expensedt').val(),
							$('#amount').val(), function(result, event){
			// If successful, clear only the expense fields not the friends list
			if(event.status){
				// Show the post feed dialog
				/*FB.ui({method: 'apprequests',
					message: 'I have shared an expense with you "' + $('#location').val() + '"',
					to: Friends.join(), 
				}, function(response){
					console.log(response);
				});*/
				// Add this expense to the list.
				getSummary();
				$('#activity').prepend(formatExpense(result, 'none'));
				$('#' + result.Id).css('background-color', '#FAE4D2').slideDown('slow');
				//setTimeout(function() {
				//    $('#' + result.Id).css('background-color', '');
				//}, 2000);

				// Collapse the section
				$('#inputExpense').siblings().slideUp('fast');
				$('#inputExpense').show();				

				// calling the API to post to your wall...
				var ppl = Names.join();
				ppl = ppl.replace(/,([^,]*)$/, " and $1");
				var obj = {
					method: 'feed',
					link: app.link,
					name: 'Shared Expense',
					caption: $('#location').val(),
					description: 'Shared an expense with ' + ppl + '.'
				};
				FB.ui(obj, function(response){console.log(response);});
			}
		});
	}
});
// Validate data
function validate(){
	// Clear previous error states
	$('.InputError').removeClass('InputError');
	
	// Validate (reverse the order so the focus is on the first logical element)
	if($('#amount').val() == '' || isNaN($('#amount').val()))
		$('#amount').addClass('InputError').show().trigger('focus');
	if($('#expensedt').val() == '')
		$('#expensedt').addClass('InputError').show();
	if($('#location').val() == '')
		$('#location').addClass('InputError').show().trigger('focus');
	if($('#sharedwith img').length == 0)
		$('#search').addClass('InputError').show().trigger('focus');

	// Return true if there are no errors
	var bIsValid = ($('.InputError').length == 0);
	return bIsValid;
}
$('.InputError').live('change', function(){ $(this).removeClass('InputError'); });

$('#content').on('click', 'a', function(){
	if(!$(this).hasClass('del')) return;
	var id = $(this).closest('.item').attr('id');
	if(id != null && id != undefined){
		$('#' + id).css('background-color', 'lightgrey');
		ShareExpenses.delExpense(id, function(result, event){
			if(result == 'success')
				$('#' + id).slideUp(1000);
		});
	}
});

function pic(id){ return 'https://graph.facebook.com/' + id + '/picture'; }
$('#sharedwith img').live("click", function(){ $(this).remove(); });
// END   ---------------------- Share Expenses release code ----------------------------