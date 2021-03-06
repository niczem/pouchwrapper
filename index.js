import PouchDB from 'pouchdb-browser'
import PouchDBAuthentication from 'pouchdb-authentication'

PouchDB.plugin(PouchDBAuthentication);

var dbWrapper = function(){
    this.databases = {};
    this.logged_in;
    this.loginCallback;
    this.config = {};

    this.setConfig = function(config){
      this.config = config;
    };
    this.initDB = function(db_name, noprefix=false){
      var self = this;
      if(typeof this.databases[db_name] == 'undefined'){

            let prefix = this.config.db_prefix;
            if(noprefix){
              prefix = '';
            }
            this.databases[db_name] = {
              local: new PouchDB(db_name, {skip_setup:false}),
              remote: new PouchDB(this.getDBURL()+prefix+db_name+'?include_docs=true&descending=true', {skip_setup:false}),   
            }

            this.databases[db_name].local.replicate.from(this.databases[db_name].remote).on('complete', function (r,a,n) {
              // yay, we're done!
              console.log('initial replication done!');

              //check if any function needs to be fired after initial replication
              for(let n in self.databases[db_name].onInitialReplicationDone){
                  if(typeof(self.databases[db_name].onInitialReplicationDone[n]) == 'function'){
                    self.databases[db_name].onInitialReplicationDone[n]();
                  }
              }
              console.log('starting sync..');
              self.databases[db_name].remote.sync(db_name, {
                live: true,
                retry: true
              }).on('change', function (change) {
                console.log('data ch change', change);
                //each database can contain multiple onchange listeners, defined by index n
                for(let n in self.databases[db_name].onChange){
                  if(typeof(self.databases[db_name].onChange[n]) == 'function'){
                    self.databases[db_name].onChange[n](change);
                  }
                }
              }).on('error', function (err) {
                //TODO exception/logging
                console.log('sync error', err);
                if(err.error === 'unauthorized'){
                  localStorage.removeItem(username);
                  localStorage.removeItem(password);
                  window.location.reload();
                }
              });

            }).on('error', function (err) {
              //TODO exception/logging
              console.log('error during inital replication:');
              console.log(err);
              if(err.error === 'unauthorized'){
                  localStorage.clear();
                  window.location.reload();
              }
              // boo, something went wrong!
            });

      }
    }
   /**
   * Sets onchange funtions for a specified database
   *
   * @param {string} db_name - Database selector
   * @param {string} method_name - Index of the method
   * @param {functoin} method - Function that is executed on db-change
   */
    this.setOnChange = function(db_name,method_name,method){
        var db = this.getDB(db_name);
        if(typeof this.databases[db_name].onChange == 'undefined'){
          this.databases[db_name].onChange = {}
        }
        this.databases[db_name].onChange[method_name] = method;
    }
    /**
    * Sets function which is fired when the initial replication for a specified database is done
    *
    * @param {string} db_name - Database selector
    * @param {string} method_name - Index of the method
    * @param {functoin} method - Function that is executed on db-initial-replication done
    */
    this.setOnInitialReplicationDone = function(db_name,method_name,method){
        var db = this.getDB(db_name);
        if(typeof this.databases[db_name].onInitialReplicationDone == 'undefined'){
          this.databases[db_name].onInitialReplicationDone = {}
        }
        this.databases[db_name].onInitialReplicationDone[method_name] = method;
    }
    this.getDB = function(db_name, noprefix=false){
        if(typeof this.databases[db_name] == 'undefined'){
            this.initDB(db_name, noprefix)
        }
        return this.databases[db_name].local;
    };
    this.showLogin = function(){
        this.loginCallback();
    };

    //sets callback function which will be called on showLogin()
    this.setLoginCallback = function(callback){
      this.loginCallback = callback;
    };

    this.login = function(username, password, db){
        db.login(username, password).then(function(res) {
          console.log(res);
          localStorage.username = username;
          localStorage.password = password;
        }).then(function(docs) {

        }).catch(function(error) {
          console.error(error);
        });
    }
    this.fetchError = function(err){
        console.log(err);
        if(err.error == "unauthorized")
            this.showLogin();
    }
    this.getDBURL = function(){
        if(typeof localStorage.username != 'undefined' && localStorage.username.length > 0)

            return 'https://'+localStorage.username+':'+localStorage.password+'@'+this.config.db_remote_host+':'+this.config.db_remote_port+'/';
        else    
            this.showLogin();
    }
}
export default new dbWrapper();
