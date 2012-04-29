global with sharing class ShareExpenses {

    @RemoteAction
    global static Expense__c saveExpense(string Friends, string Names, string WhoPaid, string WhoPaidName,
                                string Location,
                                string ExpenseDate,
                                string Amount){
        // Tokenize Friends Data
        string[] FriendsID = Friends.split(',');
        string[] FriendsName = Names.split(',');
        List<Contact> AllUsers = new List<Contact>();
        List<Expense_Detail__c> lstDetails = new List<Expense_Detail__c>();
        ID PaidByContact;
        // Convert to proper data types
        Date dtExpense = Date.parse(ExpenseDate);
        Decimal dAmount = decimal.valueOf(Amount);
        Decimal dEachAmount;
        // Remove any duplicates first
        String addedFriends = '';
        
        // Initialize all Contact records
        for(integer i=0; i<FriendsID.size(); i++){
            if(!addedFriends.contains(FriendsID[i])){
                Contact c = new Contact(Facebook__c = FriendsID[i], LastName = FriendsName[i], AccountID = '001d000000DlN4q');
                AllUsers.add(c);
                addedFriends += FriendsID[i];
            }
        }
        upsert AllUsers Facebook__c;
        
        // Get the contact record of the person who paid
        for(Contact c : AllUsers)
            if(c.Facebook__c == WhoPaid)
                PaidByContact = c.id;
        
        // If PaidByContact is still null the it means the person who paid does not share the expense
        Contact cWhoPaid = new Contact(Facebook__c = WhoPaid, LastName = WhoPaidName, AccountID = '001d000000DlN4q');
        upsert cWhoPaid Facebook__c;
        PaidByContact = cWhoPaid.id;
        
        // Calculate amount owed by each person
        dEachAmount = dAmount/AllUsers.size();
        
        // Create Expense Record
        Expense__c e     = new Expense__c();
        e.Amount__c      = dAmount;
        e.Name           = Location;
        e.Date__c        = dtExpense;
        e.Paid_By__c     = PaidByContact;
        insert e;
        
        // Create Expense Details
        for(Contact c : AllUsers){
            Expense_Detail__c d = new Expense_Detail__c();
            d.Expense__c = e.Id;
            d.Party__c   = c.id;
            d.Amount__c  = dEachAmount;
            lstDetails.add(d);    
        }
        insert lstDetails;
        
        return [SELECT ID, Name, Amount__c, Paid_By__r.Name, Paid_By__r.Facebook__c, Date__c,
                    (SELECT ID, Party__r.Name, Party__r.Facebook__c FROM Expense_Details__r)
                FROM Expense__c
                WHERE ID = :e.id];              
    }
    
    @RemoteAction
    global static Expense__c[] getRecentActivity(string me, string datefilter, string whereclause){
        Set<ID> lstExpenses = new Set<ID>();
        List<Expense__c> RecentActivity = new List<Expense__c>();
        system.debug(me);
        // Fetch recent 15 expenses in which the user is involved with
        List<Expense_Detail__c> lstDetails = new List<Expense_Detail__c>([
                                                    SELECT Expense__r.ID 
                                                    FROM Expense_Detail__c
                                                    WHERE Party__r.Facebook__c =:me
                                                    AND Expense__r.CreatedDate = THIS_MONTH]);
        for(Expense_Detail__c p : lstDetails)
            lstExpenses.add(p.Expense__r.ID);
        system.debug(lstExpenses.size());    
        // Fetch all the details for the front end    
        RecentActivity = new List<Expense__c>([
                                        SELECT ID, Name, Amount__c, Paid_By__r.Name, Paid_By__r.Facebook__c, Date__c,
                                            (SELECT ID, Party__r.Name, Party__r.Facebook__c FROM Expense_Details__r)
                                        FROM Expense__c
                                        WHERE ID IN :lstExpenses OR Paid_By__r.Facebook__c = :me
                                        ORDER BY Date__c DESC, CreatedDate DESC]);
        system.debug(RecentActivity.size());
        return RecentActivity;
    }
 
    // Retrieve all the people who owe you and the folks who you owe
    @RemoteAction
    global static List<Owe> getParties(string Me){
        
        system.debug('Fetching parties for ' + Me);
        Map<string, decimal> Summary = new Map<string, decimal>();
        
        system.debug('Fetching expenses paid by me ');
        for(Expense_Detail__c p: [SELECT Party__r.Facebook__c, Amount__c
                                    FROM Expense_Detail__c 
                                    WHERE Expense__r.Paid_By__r.Facebook__c = :Me
                                        AND Party__r.Facebook__c != :Me
                                    ORDER BY Amount__c ASC]){
            string person = p.Party__r.Facebook__c;
            // Each person gets an entry into the global list, expenses are added per person
            if(Summary.get(person) == null)
               Summary.put(person, p.Amount__c);
            else
                Summary.put(person, Summary.get(person) + p.Amount__c);
        }
        
        system.debug('Fetching expenses paid for me ');
        for(Expense_Detail__c p: [SELECT Expense__r.Paid_By__r.Facebook__c, Amount__c
                                    FROM Expense_Detail__c 
                                    WHERE Party__r.Facebook__c = :Me
                                        AND Expense__r.Paid_By__r.Facebook__c != :Me
                                    ORDER BY Amount__c DESC]){        
            string person = p.Expense__r.Paid_By__r.Facebook__c;
            // These transactions should be subtracted from the global list
            if(Summary.get(person) == null)
                Summary.put(person, -p.Amount__c);
            else
                Summary.put(person, Summary.get(person) - p.Amount__c);
        }
        // Format the amount owed
        for(string s : Summary.keySet()){
            decimal amt = Summary.get(s);
            Summary.put(s, amt.divide(1, 2));
        }
        // Now we need to send this to the UI
        List<Owe> lstOwe = new List<Owe>();
        for(Contact c : [SELECT Facebook__c, Name
                            FROM Contact
                            WHERE Facebook__c IN :Summary.keySet()]){
            lstOwe.add(new Owe(c.Facebook__c, c.Name, Summary.get(c.Facebook__c)));    
        }
        return lstOwe;
    }
    global class Owe{
        public string id    {get; set;}
        public string name  {get; set;}
        public decimal amount {get; set;}
        public Owe(string p_id, string p_name, decimal p_amount){
            this.id = p_id;
            this.name = p_name;
            this.amount = p_amount;
        }
    }
    @RemoteAction
    global static string delExpense(string record){
        Expense__c e = new Expense__c(id = record);
        delete e;
        return 'success';
    }
}