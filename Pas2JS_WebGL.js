var pas = {};

var rtl = {

  quiet: false,
  debug_load_units: false,
  debug_rtti: false,

  debug: function(){
    if (rtl.quiet || !console || !console.log) return;
    console.log(arguments);
  },

  error: function(s){
    rtl.debug('Error: ',s);
    throw s;
  },

  warn: function(s){
    rtl.debug('Warn: ',s);
  },

  hasString: function(s){
    return rtl.isString(s) && (s.length>0);
  },

  isArray: function(a) {
    return Array.isArray(a);
  },

  isFunction: function(f){
    return typeof(f)==="function";
  },

  isModule: function(m){
    return rtl.isObject(m) && rtl.hasString(m.$name) && (pas[m.$name]===m);
  },

  isImplementation: function(m){
    return rtl.isObject(m) && rtl.isModule(m.$module) && (m.$module.$impl===m);
  },

  isNumber: function(n){
    return typeof(n)==="number";
  },

  isObject: function(o){
    var s=typeof(o);
    return (typeof(o)==="object") && (o!=null);
  },

  isString: function(s){
    return typeof(s)==="string";
  },

  getNumber: function(n){
    return typeof(n)==="number"?n:NaN;
  },

  getChar: function(c){
    return ((typeof(c)==="string") && (c.length===1)) ? c : "";
  },

  getObject: function(o){
    return ((typeof(o)==="object") || (typeof(o)==='function')) ? o : null;
  },

  isPasClass: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$classname') && rtl.isObject(type.$module));
  },

  isPasClassInstance: function(type){
    return (rtl.isObject(type) && rtl.isPasClass(type.$class));
  },

  hexStr: function(n,digits){
    return ("000000000000000"+n.toString(16).toUpperCase()).slice(-digits);
  },

  m_loading: 0,
  m_loading_intf: 1,
  m_intf_loaded: 2,
  m_loading_impl: 3, // loading all used unit
  m_initializing: 4, // running initialization
  m_initialized: 5,

  module: function(module_name, intfuseslist, intfcode, impluseslist, implcode){
    if (rtl.debug_load_units) rtl.debug('rtl.module name="'+module_name+'" intfuses='+intfuseslist+' impluses='+impluseslist+' hasimplcode='+rtl.isFunction(implcode));
    if (!rtl.hasString(module_name)) rtl.error('invalid module name "'+module_name+'"');
    if (!rtl.isArray(intfuseslist)) rtl.error('invalid interface useslist of "'+module_name+'"');
    if (!rtl.isFunction(intfcode)) rtl.error('invalid interface code of "'+module_name+'"');
    if (!(impluseslist==undefined) && !rtl.isArray(impluseslist)) rtl.error('invalid implementation useslist of "'+module_name+'"');
    if (!(implcode==undefined) && !rtl.isFunction(implcode)) rtl.error('invalid implementation code of "'+module_name+'"');

    if (pas[module_name])
      rtl.error('module "'+module_name+'" is already registered');

    var module = pas[module_name] = {
      $name: module_name,
      $intfuseslist: intfuseslist,
      $impluseslist: impluseslist,
      $state: rtl.m_loading,
      $intfcode: intfcode,
      $implcode: implcode,
      $impl: null,
      $rtti: Object.create(rtl.tSectionRTTI)
    };
    module.$rtti.$module = module;
    if (implcode) module.$impl = {
      $module: module,
      $rtti: module.$rtti
    };
  },

  exitcode: 0,

  run: function(module_name){
  
    function doRun(){
      if (!rtl.hasString(module_name)) module_name='program';
      if (rtl.debug_load_units) rtl.debug('rtl.run module="'+module_name+'"');
      rtl.initRTTI();
      var module = pas[module_name];
      if (!module) rtl.error('rtl.run module "'+module_name+'" missing');
      rtl.loadintf(module);
      rtl.loadimpl(module);
      if (module_name=='program'){
        if (rtl.debug_load_units) rtl.debug('running $main');
        var r = pas.program.$main();
        if (rtl.isNumber(r)) rtl.exitcode = r;
      }
    }
    
    if (rtl.showUncaughtExceptions) {
      try{
        doRun();
      } catch(re) {
        var errMsg = re.hasOwnProperty('$class') ? re.$class.$classname : '';
	    errMsg +=  ((errMsg) ? ': ' : '') + (re.hasOwnProperty('fMessage') ? re.fMessage : re);
        alert('Uncaught Exception : '+errMsg);
        rtl.exitCode = 216;
      }
    } else {
      doRun();
    }
    return rtl.exitcode;
  },

  loadintf: function(module){
    if (module.$state>rtl.m_loading_intf) return; // already finished
    if (rtl.debug_load_units) rtl.debug('loadintf: "'+module.$name+'"');
    if (module.$state===rtl.m_loading_intf)
      rtl.error('unit cycle detected "'+module.$name+'"');
    module.$state=rtl.m_loading_intf;
    // load interfaces of interface useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadintf);
    // run interface
    if (rtl.debug_load_units) rtl.debug('loadintf: run intf of "'+module.$name+'"');
    module.$intfcode(module.$intfuseslist);
    // success
    module.$state=rtl.m_intf_loaded;
    // Note: units only used in implementations are not yet loaded (not even their interfaces)
  },

  loaduseslist: function(module,useslist,f){
    if (useslist==undefined) return;
    for (var i in useslist){
      var unitname=useslist[i];
      if (rtl.debug_load_units) rtl.debug('loaduseslist of "'+module.$name+'" uses="'+unitname+'"');
      if (pas[unitname]==undefined)
        rtl.error('module "'+module.$name+'" misses "'+unitname+'"');
      f(pas[unitname]);
    }
  },

  loadimpl: function(module){
    if (module.$state>=rtl.m_loading_impl) return; // already processing
    if (module.$state<rtl.m_intf_loaded) rtl.error('loadimpl: interface not loaded of "'+module.$name+'"');
    if (rtl.debug_load_units) rtl.debug('loadimpl: load uses of "'+module.$name+'"');
    module.$state=rtl.m_loading_impl;
    // load interfaces of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadintf);
    // load implementation of interfaces useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadimpl);
    // load implementation of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadimpl);
    // Note: At this point all interfaces used by this unit are loaded. If
    //   there are implementation uses cycles some used units might not yet be
    //   initialized. This is by design.
    // run implementation
    if (rtl.debug_load_units) rtl.debug('loadimpl: run impl of "'+module.$name+'"');
    if (rtl.isFunction(module.$implcode)) module.$implcode(module.$impluseslist);
    // run initialization
    if (rtl.debug_load_units) rtl.debug('loadimpl: run init of "'+module.$name+'"');
    module.$state=rtl.m_initializing;
    if (rtl.isFunction(module.$init)) module.$init();
    // unit initialized
    module.$state=rtl.m_initialized;
  },

  createCallback: function(scope, fn){
    var cb;
    if (typeof(fn)==='string'){
      cb = function(){
        return scope[fn].apply(scope,arguments);
      };
    } else {
      cb = function(){
        return fn.apply(scope,arguments);
      };
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  cloneCallback: function(cb){
    return rtl.createCallback(cb.scope,cb.fn);
  },

  eqCallback: function(a,b){
    // can be a function or a function wrapper
    if (a==b){
      return true;
    } else {
      return (a!=null) && (b!=null) && (a.fn) && (a.scope===b.scope) && (a.fn==b.fn);
    }
  },

  initClass: function(c,parent,name,initfn){
    parent[name] = c;
    c.$classname = name;
    if ((parent.$module) && (parent.$module.$impl===parent)) parent=parent.$module;
    c.$parent = parent;
    c.$fullname = parent.$name+'.'+name;
    if (rtl.isModule(parent)){
      c.$module = parent;
      c.$name = name;
    } else {
      c.$module = parent.$module;
      c.$name = parent.name+'.'+name;
    };
    // rtti
    if (rtl.debug_rtti) rtl.debug('initClass '+c.$fullname);
    var t = c.$module.$rtti.$Class(c.$name,{ "class": c, module: parent });
    c.$rtti = t;
    if (rtl.isObject(c.$ancestor)) t.ancestor = c.$ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  createClass: function(parent,name,ancestor,initfn){
    // create a normal class,
    // ancestor must be null or a normal class,
    // the root ancestor can be an external class
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // Note:
      // if root is an "object" then c.$ancestor === Object.getPrototypeOf(c)
      // if root is a "function" then c.$ancestor === c.__proto__, Object.getPrototypeOf(c) returns the root
    } else {
      c = {};
      c.$create = function(fnname,args){
        if (args == undefined) args = [];
        var o = Object.create(this);
        o.$class = this; // Note: o.$class === Object.getPrototypeOf(o)
        o.$init();
        try{
          o[fnname].apply(o,args);
          o.AfterConstruction();
        } catch($e){
          o.$destroy;
          throw $e;
        }
        return o;
      };
      c.$destroy = function(fnname){
        this.BeforeDestruction();
        this[fnname]();
        this.$final;
      };
    };
    rtl.initClass(c,parent,name,initfn);
  },

  createClassExt: function(parent,name,ancestor,newinstancefnname,initfn){
    // Create a class using an external ancestor.
    // If newinstancefnname is given, use that function to create the new object.
    // If exist call BeforeDestruction and AfterConstruction.
    var c = null;
    c = Object.create(ancestor);
    c.$create = function(fnname,args){
      if (args == undefined) args = [];
      var o = null;
      if (newinstancefnname.length>0){
        o = this[newinstancefnname](fnname,args);
      } else {
        o = Object.create(this);
      }
      o.$class = this; // Note: o.$class === Object.getPrototypeOf(o)
      o.$init();
      try{
        o[fnname].apply(o,args);
        if (o.AfterConstruction) o.AfterConstruction();
      } catch($e){
        o.$destroy;
        throw $e;
      }
      return o;
    };
    c.$destroy = function(fnname){
      if (this.BeforeDestruction) this.BeforeDestruction();
      this[fnname]();
      this.$final;
    };
    rtl.initClass(c,parent,name,initfn);
  },

  tObjectDestroy: "Destroy",

  free: function(obj,name){
    if (obj[name]==null) return;
    obj[name].$destroy(rtl.tObjectDestroy);
    obj[name]=null;
  },

  freeLoc: function(obj){
    if (obj==null) return;
    obj.$destroy(rtl.tObjectDestroy);
    return null;
  },

  is: function(instance,type){
    return type.isPrototypeOf(instance) || (instance===type);
  },

  isExt: function(instance,type,mode){
    // mode===1 means instance must be a Pascal class instance
    // mode===2 means instance must be a Pascal class
    // Notes:
    // isPrototypeOf and instanceof return false on equal
    // isPrototypeOf does not work for Date.isPrototypeOf(new Date())
    //   so if isPrototypeOf is false test with instanceof
    // instanceof needs a function on right side
    if (instance == null) return false; // Note: ==null checks for undefined too
    if ((typeof(type) !== 'object') && (typeof(type) !== 'function')) return false;
    if (instance === type){
      if (mode===1) return false;
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if (type.isPrototypeOf && type.isPrototypeOf(instance)){
      if (mode===1) return rtl.isPasClassInstance(instance);
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if ((typeof type == 'function') && (instance instanceof type)) return true;
    return false;
  },

  Exception: null,
  EInvalidCast: null,
  EAbstractError: null,
  ERangeError: null,

  raiseE: function(typename){
    var t = rtl[typename];
    if (t==null){
      var mod = pas.SysUtils;
      if (!mod) mod = pas.sysutils;
      if (mod){
        t = mod[typename];
        if (!t) t = mod[typename.toLowerCase()];
        if (!t) t = mod['Exception'];
        if (!t) t = mod['exception'];
      }
    }
    if (t){
      if (t.Create){
        throw t.$create("Create");
      } else if (t.create){
        throw t.$create("create");
      }
    }
    if (typename === "EInvalidCast") throw "invalid type cast";
    if (typename === "EAbstractError") throw "Abstract method called";
    if (typename === "ERangeError") throw "range error";
    throw typename;
  },

  as: function(instance,type){
    if((instance === null) || rtl.is(instance,type)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  asExt: function(instance,type,mode){
    if((instance === null) || rtl.isExt(instance,type,mode)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  createInterface: function(module, name, guid, fnnames, ancestor, initfn){
    //console.log('createInterface name="'+name+'" guid="'+guid+'" names='+fnnames);
    var i = ancestor?Object.create(ancestor):{};
    module[name] = i;
    i.$module = module;
    i.$name = name;
    i.$fullname = module.$name+'.'+name;
    i.$guid = guid;
    i.$guidr = null;
    i.$names = fnnames?fnnames:[];
    if (rtl.isFunction(initfn)){
      // rtti
      if (rtl.debug_rtti) rtl.debug('createInterface '+i.$fullname);
      var t = i.$module.$rtti.$Interface(name,{ "interface": i, module: module });
      i.$rtti = t;
      if (ancestor) t.ancestor = ancestor.$rtti;
      if (!t.ancestor) t.ancestor = null;
      initfn.call(i);
    }
    return i;
  },

  strToGUIDR: function(s,g){
    var p = 0;
    function n(l){
      var h = s.substr(p,l);
      p+=l;
      return parseInt(h,16);
    }
    p+=1; // skip {
    g.D1 = n(8);
    p+=1; // skip -
    g.D2 = n(4);
    p+=1; // skip -
    g.D3 = n(4);
    p+=1; // skip -
    if (!g.D4) g.D4=[];
    g.D4[0] = n(2);
    g.D4[1] = n(2);
    p+=1; // skip -
    for(var i=2; i<8; i++) g.D4[i] = n(2);
    return g;
  },

  guidrToStr: function(g){
    if (g.$intf) return g.$intf.$guid;
    var h = rtl.hexStr;
    var s='{'+h(g.D1,8)+'-'+h(g.D2,4)+'-'+h(g.D3,4)+'-'+h(g.D4[0],2)+h(g.D4[1],2)+'-';
    for (var i=2; i<8; i++) s+=h(g.D4[i],2);
    s+='}';
    return s;
  },

  createTGUID: function(guid){
    var TGuid = (pas.System)?pas.System.TGuid:pas.system.tguid;
    var g = rtl.strToGUIDR(guid,new TGuid());
    return g;
  },

  getIntfGUIDR: function(intfTypeOrVar){
    if (!intfTypeOrVar) return null;
    if (!intfTypeOrVar.$guidr){
      var g = rtl.createTGUID(intfTypeOrVar.$guid);
      if (!intfTypeOrVar.hasOwnProperty('$guid')) intfTypeOrVar = Object.getPrototypeOf(intfTypeOrVar);
      g.$intf = intfTypeOrVar;
      intfTypeOrVar.$guidr = g;
    }
    return intfTypeOrVar.$guidr;
  },

  addIntf: function (aclass, intf, map){
    function jmp(fn){
      if (typeof(fn)==="function"){
        return function(){ return fn.apply(this.$o,arguments); };
      } else {
        return function(){ rtl.raiseE('EAbstractError'); };
      }
    }
    if(!map) map = {};
    var t = intf;
    var item = Object.create(t);
    aclass.$intfmaps[intf.$guid] = item;
    do{
      var names = t.$names;
      if (!names) break;
      for (var i=0; i<names.length; i++){
        var intfname = names[i];
        var fnname = map[intfname];
        if (!fnname) fnname = intfname;
        //console.log('addIntf: intftype='+t.$name+' index='+i+' intfname="'+intfname+'" fnname="'+fnname+'" proc='+typeof(fn));
        item[intfname] = jmp(aclass[fnname]);
      }
      t = Object.getPrototypeOf(t);
    }while(t!=null);
  },

  getIntfG: function (obj, guid, query){
    if (!obj) return null;
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query);
    // search
    var maps = obj.$intfmaps;
    if (!maps) return null;
    var item = maps[guid];
    if (!item) return null;
    // check delegation
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query+' item='+typeof(item));
    if (typeof item === 'function') return item.call(obj); // COM: contains _AddRef
    // check cache
    var intf = null;
    if (obj.$interfaces){
      intf = obj.$interfaces[guid];
      //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' cache='+typeof(intf));
    }
    if (!intf){ // intf can be undefined!
      intf = Object.create(item);
      intf.$o = obj;
      if (!obj.$interfaces) obj.$interfaces = {};
      obj.$interfaces[guid] = intf;
    }
    if (typeof(query)==='object'){
      // called by queryIntfT
      var o = null;
      if (intf.QueryInterface(rtl.getIntfGUIDR(query),
          {get:function(){ return o; }, set:function(v){ o=v; }}) === 0){
        return o;
      } else {
        return null;
      }
    } else if(query===2){
      // called by TObject.GetInterfaceByStr
      if (intf.$kind === 'com') intf._AddRef();
    }
    return intf;
  },

  getIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid);
  },

  queryIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid,intftype);
  },

  queryIntfIsT: function(obj,intftype){
    var i = rtl.queryIntfG(obj,intftype.$guid);
    if (!i) return false;
    if (i.$kind === 'com') i._Release();
    return true;
  },

  asIntfT: function (obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (i!==null) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsClass: function(intf,classtype){
    return (intf!=null) && (rtl.is(intf.$o,classtype));
  },

  intfAsClass: function(intf,classtype){
    if (intf==null) return null;
    return rtl.as(intf.$o,classtype);
  },

  intfToClass: function(intf,classtype){
    if ((intf!==null) && rtl.is(intf.$o,classtype)) return intf.$o;
    return null;
  },

  // interface reference counting
  intfRefs: { // base object for temporary interface variables
    ref: function(id,intf){
      // called for temporary interface references needing delayed release
      var old = this[id];
      //console.log('rtl.intfRefs.ref: id='+id+' old="'+(old?old.$name:'null')+'" intf="'+(intf?intf.$name:'null'));
      if (old){
        // called again, e.g. in a loop
        delete this[id];
        old._Release(); // may fail
      }
      this[id]=intf;
      return intf;
    },
    free: function(){
      //console.log('rtl.intfRefs.free...');
      for (var id in this){
        if (this.hasOwnProperty(id)) this[id]._Release;
      }
    }
  },

  createIntfRefs: function(){
    //console.log('rtl.createIntfRefs');
    return Object.create(rtl.intfRefs);
  },

  setIntfP: function(path,name,value,skipAddRef){
    var old = path[name];
    //console.log('rtl.setIntfP path='+path+' name='+name+' old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old === value) return;
    if (old !== null){
      path[name]=null;
      old._Release();
    }
    if (value !== null){
      if (!skipAddRef) value._AddRef();
      path[name]=value;
    }
  },

  setIntfL: function(old,value,skipAddRef){
    //console.log('rtl.setIntfL old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old !== value){
      if (value!==null){
        if (!skipAddRef) value._AddRef();
      }
      if (old!==null){
        old._Release();  // Release after AddRef, to avoid double Release if Release creates an exception
      }
    } else if (skipAddRef){
      if (old!==null){
        old._Release();  // value has an AddRef
      }
    }
    return value;
  },

  _AddRef: function(intf){
    //if (intf) console.log('rtl._AddRef intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._AddRef();
    return intf;
  },

  _Release: function(intf){
    //if (intf) console.log('rtl._Release intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._Release();
    return intf;
  },

  checkMethodCall: function(obj,type){
    if (rtl.isObject(obj) && rtl.is(obj,type)) return;
    rtl.raiseE("EInvalidCast");
  },

  rc: function(i,minval,maxval){
    // range check integer
    if ((Math.floor(i)===i) && (i>=minval) && (i<=maxval)) return i;
    rtl.raiseE('ERangeError');
  },

  rcc: function(c,minval,maxval){
    // range check char
    if ((typeof(c)==='string') && (c.length===1)){
      var i = c.charCodeAt(0);
      if ((i>=minval) && (i<=maxval)) return c;
    }
    rtl.raiseE('ERangeError');
  },

  rcSetCharAt: function(s,index,c){
    // range check setCharAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return rtl.setCharAt(s,index,c);
  },

  rcCharAt: function(s,index){
    // range check charAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return s.charAt(index);
  },

  rcArrR: function(arr,index){
    // range check read array
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      if (arguments.length>2){
        // arr,index1,index2,...
        arr=arr[index];
        for (var i=2; i<arguments.length; i++) arr=rtl.rcArrR(arr,arguments[i]);
        return arr;
      }
      return arr[index];
    }
    rtl.raiseE('ERangeError');
  },

  rcArrW: function(arr,index,value){
    // range check write array
    // arr,index1,index2,...,value
    for (var i=3; i<arguments.length; i++){
      arr=rtl.rcArrR(arr,index);
      index=arguments[i-1];
      value=arguments[i];
    }
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      return arr[index]=value;
    }
    rtl.raiseE('ERangeError');
  },

  length: function(arr){
    return (arr == null) ? 0 : arr.length;
  },

  arraySetLength: function(arr,defaultvalue,newlength){
    // multi dim: (arr,defaultvalue,dim1,dim2,...)
    if (arr == null) arr = [];
    var p = arguments;
    function setLength(a,argNo){
      var oldlen = a.length;
      var newlen = p[argNo];
      if (oldlen!==newlength){
        a.length = newlength;
        if (argNo === p.length-1){
          if (rtl.isArray(defaultvalue)){
            for (var i=oldlen; i<newlen; i++) a[i]=[]; // nested array
          } else if (rtl.isFunction(defaultvalue)){
            for (var i=oldlen; i<newlen; i++) a[i]=new defaultvalue(); // e.g. record
          } else if (rtl.isObject(defaultvalue)) {
            for (var i=oldlen; i<newlen; i++) a[i]={}; // e.g. set
          } else {
            for (var i=oldlen; i<newlen; i++) a[i]=defaultvalue;
          }
        } else {
          for (var i=oldlen; i<newlen; i++) a[i]=[]; // nested array
        }
      }
      if (argNo < p.length-1){
        // multi argNo
        for (var i=0; i<newlen; i++) a[i]=setLength(a[i],argNo+1);
      }
      return a;
    }
    return setLength(arr,2);
  },

  arrayEq: function(a,b){
    if (a===null) return b===null;
    if (b===null) return false;
    if (a.length!==b.length) return false;
    for (var i=0; i<a.length; i++) if (a[i]!==b[i]) return false;
    return true;
  },

  arrayClone: function(type,src,srcpos,end,dst,dstpos){
    // type: 0 for references, "refset" for calling refSet(), a function for new type()
    // src must not be null
    // This function does not range check.
    if (rtl.isFunction(type)){
      for (; srcpos<end; srcpos++) dst[dstpos++] = new type(src[srcpos]); // clone record
    } else if((typeof(type)==="string") && (type === 'refSet')) {
      for (; srcpos<end; srcpos++) dst[dstpos++] = rtl.refSet(src[srcpos]); // ref set
    }  else {
      for (; srcpos<end; srcpos++) dst[dstpos++] = src[srcpos]; // reference
    };
  },

  arrayConcat: function(type){
    // type: see rtl.arrayClone
    var a = [];
    var l = 0;
    for (var i=1; i<arguments.length; i++) l+=arguments[i].length;
    a.length = l;
    l=0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src == null) continue;
      rtl.arrayClone(type,src,0,src.length,a,l);
      l+=src.length;
    };
    return a;
  },

  arrayCopy: function(type, srcarray, index, count){
    // type: see rtl.arrayClone
    // if count is missing, use srcarray.length
    if (srcarray == null) return [];
    if (index < 0) index = 0;
    if (count === undefined) count=srcarray.length;
    var end = index+count;
    if (end>srcarray.length) end = srcarray.length;
    if (index>=end) return [];
    if (type===0){
      return srcarray.slice(index,end);
    } else {
      var a = [];
      a.length = end-index;
      rtl.arrayClone(type,srcarray,index,end,a,0);
      return a;
    }
  },

  setCharAt: function(s,index,c){
    return s.substr(0,index)+c+s.substr(index+1);
  },

  getResStr: function(mod,name){
    var rs = mod.$resourcestrings[name];
    return rs.current?rs.current:rs.org;
  },

  createSet: function(){
    var s = {};
    for (var i=0; i<arguments.length; i++){
      if (arguments[i]!=null){
        s[arguments[i]]=true;
      } else {
        var first=arguments[i+=1];
        var last=arguments[i+=1];
        for(var j=first; j<=last; j++) s[j]=true;
      }
    }
    return s;
  },

  cloneSet: function(s){
    var r = {};
    for (var key in s) r[key]=true;
    return r;
  },

  refSet: function(s){
    s.$shared = true;
    return s;
  },

  includeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    s[enumvalue] = true;
    return s;
  },

  excludeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    delete s[enumvalue];
    return s;
  },

  diffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    delete r.$shared;
    return r;
  },

  unionSet: function(s,t){
    var r = {};
    for (var key in s) r[key]=true;
    for (var key in t) r[key]=true;
    delete r.$shared;
    return r;
  },

  intersectSet: function(s,t){
    var r = {};
    for (var key in s) if (t[key]) r[key]=true;
    delete r.$shared;
    return r;
  },

  symDiffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    for (var key in t) if (!s[key]) r[key]=true;
    delete r.$shared;
    return r;
  },

  eqSet: function(s,t){
    for (var key in s) if (!t[key] && (key!='$shared')) return false;
    for (var key in t) if (!s[key] && (key!='$shared')) return false;
    return true;
  },

  neSet: function(s,t){
    return !rtl.eqSet(s,t);
  },

  leSet: function(s,t){
    for (var key in s) if (!t[key] && (key!='$shared')) return false;
    return true;
  },

  geSet: function(s,t){
    for (var key in t) if (!s[key] && (key!='$shared')) return false;
    return true;
  },

  strSetLength: function(s,newlen){
    var oldlen = s.length;
    if (oldlen > newlen){
      return s.substring(0,newlen);
    } else if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return s+' '.repeat(newlen-oldlen);
    } else {
       while (oldlen<newlen){
         s+=' ';
         oldlen++;
       };
       return s;
    }
  },

  spaceLeft: function(s,width){
    var l=s.length;
    if (l>=width) return s;
    if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return ' '.repeat(width-l) + s;
    } else {
      while (l<width){
        s=' '+s;
        l++;
      };
    };
  },

  floatToStr : function(d,w,p){
    // input 1-3 arguments: double, width, precision
    if (arguments.length>2){
      return rtl.spaceLeft(d.toFixed(p),w);
    } else {
	  // exponent width
	  var pad = "";
	  var ad = Math.abs(d);
	  if (ad<1.0e+10) {
		pad='00';
	  } else if (ad<1.0e+100) {
		pad='0';
      }  	
	  if (arguments.length<2) {
	    w=9;		
      } else if (w<9) {
		w=9;
      }		  
      var p = w-8;
      var s=(d>0 ? " " : "" ) + d.toExponential(p);
      s=s.replace(/e(.)/,'E$1'+pad);
      return rtl.spaceLeft(s,w);
    }
  },

  initRTTI: function(){
    if (rtl.debug_rtti) rtl.debug('initRTTI');

    // base types
    rtl.tTypeInfo = { name: "tTypeInfo" };
    function newBaseTI(name,kind,ancestor){
      if (!ancestor) ancestor = rtl.tTypeInfo;
      if (rtl.debug_rtti) rtl.debug('initRTTI.newBaseTI "'+name+'" '+kind+' ("'+ancestor.name+'")');
      var t = Object.create(ancestor);
      t.name = name;
      t.kind = kind;
      rtl[name] = t;
      return t;
    };
    function newBaseInt(name,minvalue,maxvalue,ordtype){
      var t = newBaseTI(name,1 /* tkInteger */,rtl.tTypeInfoInteger);
      t.minvalue = minvalue;
      t.maxvalue = maxvalue;
      t.ordtype = ordtype;
      return t;
    };
    newBaseTI("tTypeInfoInteger",1 /* tkInteger */);
    newBaseInt("shortint",-0x80,0x7f,0);
    newBaseInt("byte",0,0xff,1);
    newBaseInt("smallint",-0x8000,0x7fff,2);
    newBaseInt("word",0,0xffff,3);
    newBaseInt("longint",-0x80000000,0x7fffffff,4);
    newBaseInt("longword",0,0xffffffff,5);
    newBaseInt("nativeint",-0x10000000000000,0xfffffffffffff,6);
    newBaseInt("nativeuint",0,0xfffffffffffff,7);
    newBaseTI("char",2 /* tkChar */);
    newBaseTI("string",3 /* tkString */);
    newBaseTI("tTypeInfoEnum",4 /* tkEnumeration */,rtl.tTypeInfoInteger);
    newBaseTI("tTypeInfoSet",5 /* tkSet */);
    newBaseTI("double",6 /* tkDouble */);
    newBaseTI("boolean",7 /* tkBool */);
    newBaseTI("tTypeInfoProcVar",8 /* tkProcVar */);
    newBaseTI("tTypeInfoMethodVar",9 /* tkMethod */,rtl.tTypeInfoProcVar);
    newBaseTI("tTypeInfoArray",10 /* tkArray */);
    newBaseTI("tTypeInfoDynArray",11 /* tkDynArray */);
    newBaseTI("tTypeInfoPointer",15 /* tkPointer */);
    var t = newBaseTI("pointer",15 /* tkPointer */,rtl.tTypeInfoPointer);
    t.reftype = null;
    newBaseTI("jsvalue",16 /* tkJSValue */);
    newBaseTI("tTypeInfoRefToProcVar",17 /* tkRefToProcVar */,rtl.tTypeInfoProcVar);

    // member kinds
    rtl.tTypeMember = {};
    function newMember(name,kind){
      var m = Object.create(rtl.tTypeMember);
      m.name = name;
      m.kind = kind;
      rtl[name] = m;
    };
    newMember("tTypeMemberField",1); // tmkField
    newMember("tTypeMemberMethod",2); // tmkMethod
    newMember("tTypeMemberProperty",3); // tmkProperty

    // base object for storing members: a simple object
    rtl.tTypeMembers = {};

    // tTypeInfoStruct - base object for tTypeInfoClass, tTypeInfoRecord, tTypeInfoInterface
    var tis = newBaseTI("tTypeInfoStruct",0);
    tis.$addMember = function(name,ancestor,options){
      if (rtl.debug_rtti){
        if (!rtl.hasString(name) || (name.charAt()==='$')) throw 'invalid member "'+name+'", this="'+this.name+'"';
        if (!rtl.is(ancestor,rtl.tTypeMember)) throw 'invalid ancestor "'+ancestor+':'+ancestor.name+'", "'+this.name+'.'+name+'"';
        if ((options!=undefined) && (typeof(options)!='object')) throw 'invalid options "'+options+'", "'+this.name+'.'+name+'"';
      };
      var t = Object.create(ancestor);
      t.name = name;
      this.members[name] = t;
      this.names.push(name);
      if (rtl.isObject(options)){
        for (var key in options) if (options.hasOwnProperty(key)) t[key] = options[key];
      };
      return t;
    };
    tis.addField = function(name,type,options){
      var t = this.$addMember(name,rtl.tTypeMemberField,options);
      if (rtl.debug_rtti){
        if (!rtl.is(type,rtl.tTypeInfo)) throw 'invalid type "'+type+'", "'+this.name+'.'+name+'"';
      };
      t.typeinfo = type;
      this.fields.push(name);
      return t;
    };
    tis.addFields = function(){
      var i=0;
      while(i<arguments.length){
        var name = arguments[i++];
        var type = arguments[i++];
        if ((i<arguments.length) && (typeof(arguments[i])==='object')){
          this.addField(name,type,arguments[i++]);
        } else {
          this.addField(name,type);
        };
      };
    };
    tis.addMethod = function(name,methodkind,params,result,options){
      var t = this.$addMember(name,rtl.tTypeMemberMethod,options);
      t.methodkind = methodkind;
      t.procsig = rtl.newTIProcSig(params);
      t.procsig.resulttype = result?result:null;
      this.methods.push(name);
      return t;
    };
    tis.addProperty = function(name,flags,result,getter,setter,options){
      var t = this.$addMember(name,rtl.tTypeMemberProperty,options);
      t.flags = flags;
      t.typeinfo = result;
      t.getter = getter;
      t.setter = setter;
      // Note: in options: params, stored, defaultvalue
      if (rtl.isArray(t.params)) t.params = rtl.newTIParams(t.params);
      this.properties.push(name);
      if (!rtl.isString(t.stored)) t.stored = "";
      return t;
    };
    tis.getField = function(index){
      return this.members[this.fields[index]];
    };
    tis.getMethod = function(index){
      return this.members[this.methods[index]];
    };
    tis.getProperty = function(index){
      return this.members[this.properties[index]];
    };

    newBaseTI("tTypeInfoRecord",12 /* tkRecord */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClass",13 /* tkClass */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClassRef",14 /* tkClassRef */);
    newBaseTI("tTypeInfoInterface",15 /* tkInterface */,rtl.tTypeInfoStruct);
  },

  tSectionRTTI: {
    $module: null,
    $inherited: function(name,ancestor,o){
      if (rtl.debug_rtti){
        rtl.debug('tSectionRTTI.newTI "'+(this.$module?this.$module.$name:"(no module)")
          +'"."'+name+'" ('+ancestor.name+') '+(o?'init':'forward'));
      };
      var t = this[name];
      if (t){
        if (!t.$forward) throw 'duplicate type "'+name+'"';
        if (!ancestor.isPrototypeOf(t)) throw 'typeinfo ancestor mismatch "'+name+'" ancestor="'+ancestor.name+'" t.name="'+t.name+'"';
      } else {
        t = Object.create(ancestor);
        t.name = name;
        t.module = this.module;
        this[name] = t;
      }
      if (o){
        delete t.$forward;
        for (var key in o) if (o.hasOwnProperty(key)) t[key]=o[key];
      } else {
        t.$forward = true;
      }
      return t;
    },
    $Scope: function(name,ancestor,o){
      var t=this.$inherited(name,ancestor,o);
      t.members = {};
      t.names = [];
      t.fields = [];
      t.methods = [];
      t.properties = [];
      return t;
    },
    $TI: function(name,kind,o){ var t=this.$inherited(name,rtl.tTypeInfo,o); t.kind = kind; return t; },
    $Int: function(name,o){ return this.$inherited(name,rtl.tTypeInfoInteger,o); },
    $Enum: function(name,o){ return this.$inherited(name,rtl.tTypeInfoEnum,o); },
    $Set: function(name,o){ return this.$inherited(name,rtl.tTypeInfoSet,o); },
    $StaticArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoArray,o); },
    $DynArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoDynArray,o); },
    $ProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoProcVar,o); },
    $RefToProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoRefToProcVar,o); },
    $MethodVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoMethodVar,o); },
    $Record: function(name,o){ return this.$Scope(name,rtl.tTypeInfoRecord,o); },
    $Class: function(name,o){ return this.$Scope(name,rtl.tTypeInfoClass,o); },
    $ClassRef: function(name,o){ return this.$inherited(name,rtl.tTypeInfoClassRef,o); },
    $Pointer: function(name,o){ return this.$inherited(name,rtl.tTypeInfoPointer,o); },
    $Interface: function(name,o){ return this.$Scope(name,rtl.tTypeInfoInterface,o); }
  },

  newTIParam: function(param){
    // param is an array, 0=name, 1=type, 2=optional flags
    var t = {
      name: param[0],
      typeinfo: param[1],
      flags: (rtl.isNumber(param[2]) ? param[2] : 0)
    };
    return t;
  },

  newTIParams: function(list){
    // list: optional array of [paramname,typeinfo,optional flags]
    var params = [];
    if (rtl.isArray(list)){
      for (var i=0; i<list.length; i++) params.push(rtl.newTIParam(list[i]));
    };
    return params;
  },

  newTIProcSig: function(params,result,flags){
    var s = {
      params: rtl.newTIParams(params),
      resulttype: result,
      flags: flags
    };
    return s;
  }
}
rtl.module("System",[],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.LineEnding = "\n";
  this.sLineBreak = $mod.LineEnding;
  rtl.createClass($mod,"TObject",null,function () {
    this.$init = function () {
    };
    this.$final = function () {
    };
    this.Create = function () {
    };
    this.AfterConstruction = function () {
    };
    this.BeforeDestruction = function () {
    };
  });
  this.Writeln = function () {
    var i = 0;
    var l = 0;
    var s = "";
    l = rtl.length(arguments) - 1;
    if ($impl.WriteCallBack != null) {
      for (var $l1 = 0, $end2 = l; $l1 <= $end2; $l1++) {
        i = $l1;
        $impl.WriteCallBack(arguments[i],i === l);
      };
    } else {
      s = $impl.WriteBuf;
      for (var $l3 = 0, $end4 = l; $l3 <= $end4; $l3++) {
        i = $l3;
        s = s + ("" + arguments[i]);
      };
      console.log(s);
      $impl.WriteBuf = "";
    };
  };
  this.SetWriteCallBack = function (H) {
    var Result = null;
    Result = $impl.WriteCallBack;
    $impl.WriteCallBack = H;
    return Result;
  };
  $mod.$init = function () {
    rtl.exitcode = 0;
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.WriteBuf = "";
  $impl.WriteCallBack = null;
});
rtl.module("JS",["System"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("Web",["System","JS"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("browserconsole",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.DefaultMaxConsoleLines = 25;
  this.DefaultConsoleStyle = (((((((((((".pasconsole { " + pas.System.sLineBreak) + "font-family: courier;") + pas.System.sLineBreak) + "font-size: 14px;") + pas.System.sLineBreak) + "background: #FFFFFF;") + pas.System.sLineBreak) + "color: #000000;") + pas.System.sLineBreak) + "display: block;") + pas.System.sLineBreak) + "}";
  this.ConsoleElementID = "";
  this.ConsoleStyle = "";
  this.MaxConsoleLines = 0;
  this.ConsoleLinesToBrowserLog = false;
  this.ResetConsole = function () {
    if ($impl.LinesParent === null) return;
    while ($impl.LinesParent.firstElementChild !== null) $impl.LinesParent.removeChild($impl.LinesParent.firstElementChild);
    $impl.AppendLine();
  };
  this.InitConsole = function () {
    if ($impl.ConsoleElement === null) return;
    if ($impl.ConsoleElement.nodeName.toLowerCase() !== "body") {
      while ($impl.ConsoleElement.firstElementChild !== null) $impl.ConsoleElement.removeChild($impl.ConsoleElement.firstElementChild);
    };
    $impl.StyleElement = document.createElement("style");
    $impl.StyleElement.innerText = $mod.ConsoleStyle;
    $impl.ConsoleElement.appendChild($impl.StyleElement);
    $impl.LinesParent = document.createElement("div");
    $impl.ConsoleElement.appendChild($impl.LinesParent);
  };
  this.HookConsole = function () {
    $impl.ConsoleElement = null;
    if ($mod.ConsoleElementID !== "") $impl.ConsoleElement = document.getElementById($mod.ConsoleElementID);
    if ($impl.ConsoleElement === null) $impl.ConsoleElement = document.body;
    if ($impl.ConsoleElement === null) return;
    $mod.InitConsole();
    $mod.ResetConsole();
    pas.System.SetWriteCallBack($impl.WriteConsole);
  };
  $mod.$init = function () {
    $mod.ConsoleLinesToBrowserLog = true;
    $mod.ConsoleElementID = "pasjsconsole";
    $mod.ConsoleStyle = $mod.DefaultConsoleStyle;
    $mod.MaxConsoleLines = 25;
    $mod.HookConsole();
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.LastLine = null;
  $impl.StyleElement = null;
  $impl.LinesParent = null;
  $impl.ConsoleElement = null;
  $impl.AppendLine = function () {
    var CurrentCount = 0;
    var S = null;
    CurrentCount = 0;
    S = $impl.LinesParent.firstChild;
    while (S != null) {
      CurrentCount += 1;
      S = S.nextSibling;
    };
    while (CurrentCount > $mod.MaxConsoleLines) {
      CurrentCount -= 1;
      $impl.LinesParent.removeChild($impl.LinesParent.firstChild);
    };
    $impl.LastLine = document.createElement("div");
    $impl.LastLine.className = "pasconsole";
    $impl.LinesParent.appendChild($impl.LastLine);
  };
  $impl.WriteConsole = function (S, NewLine) {
    var CL = "";
    CL = $impl.LastLine.innerText;
    CL = CL + ("" + S);
    $impl.LastLine.innerText = CL;
    if (NewLine) {
      if ($mod.ConsoleLinesToBrowserLog) window.console.log(CL);
      $impl.AppendLine();
    };
  };
});
rtl.module("SysUtils",["System","JS"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass($mod,"TFormatSettings",pas.System.TObject,function () {
  });
  this.FormatSettings = null;
  $mod.$init = function () {
    $mod.FormatSettings = $mod.TFormatSettings.$create("Create");
  };
});
rtl.module("math",["System","SysUtils"],function () {
  "use strict";
  var $mod = this;
  this.DegToRad = function (deg) {
    var Result = 0.0;
    Result = deg * (Math.PI / 180.0);
    return Result;
  };
});
rtl.module("Mat4",["System","browserconsole","JS","math"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass($mod,"TMat4",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.RawComponents = rtl.arraySetLength(null,0.0,4,4);
    };
    this.$final = function () {
      this.RawComponents = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Identity = function () {
      this.RawComponents[0][0] = 1.0;
      this.RawComponents[0][1] = 0.0;
      this.RawComponents[0][2] = 0.0;
      this.RawComponents[0][3] = 0.0;
      this.RawComponents[1][0] = 0.0;
      this.RawComponents[1][1] = 1.0;
      this.RawComponents[1][2] = 0.0;
      this.RawComponents[1][3] = 0.0;
      this.RawComponents[2][0] = 0.0;
      this.RawComponents[2][1] = 0.0;
      this.RawComponents[2][2] = 1.0;
      this.RawComponents[2][3] = 0.0;
      this.RawComponents[3][0] = 0.0;
      this.RawComponents[3][1] = 0.0;
      this.RawComponents[3][2] = 0.0;
      this.RawComponents[3][3] = 1.0;
    };
    this.Translate = function (tx, ty, tz) {
      this.RawComponents[0][0] = 1.0;
      this.RawComponents[0][1] = 0.0;
      this.RawComponents[0][2] = 0.0;
      this.RawComponents[0][3] = 0.0;
      this.RawComponents[1][0] = 0.0;
      this.RawComponents[1][1] = 1.0;
      this.RawComponents[1][2] = 0.0;
      this.RawComponents[1][3] = 0.0;
      this.RawComponents[2][0] = 0.0;
      this.RawComponents[2][1] = 0.0;
      this.RawComponents[2][2] = 1.0;
      this.RawComponents[2][3] = 0.0;
      this.RawComponents[3][0] = tx;
      this.RawComponents[3][1] = ty;
      this.RawComponents[3][2] = tz;
      this.RawComponents[3][3] = 1.0;
    };
    this.RotateZ = function (Angle) {
      $mod.SinCos(Angle,{a: 1, p: this.RawComponents[0], get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }},{a: 0, p: this.RawComponents[0], get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }});
      this.RawComponents[0][2] = 0.0;
      this.RawComponents[0][3] = 0.0;
      this.RawComponents[1][0] = -this.RawComponents[0][1];
      this.RawComponents[1][1] = this.RawComponents[0][0];
      this.RawComponents[1][2] = 0.0;
      this.RawComponents[1][3] = 0.0;
      this.RawComponents[2][0] = 0.0;
      this.RawComponents[2][1] = 0.0;
      this.RawComponents[2][2] = 1.0;
      this.RawComponents[2][3] = 0.0;
      this.RawComponents[3][0] = 0.0;
      this.RawComponents[3][1] = 0.0;
      this.RawComponents[3][2] = 0.0;
      this.RawComponents[3][3] = 1.0;
    };
    this.Ortho = function (Left, Right, Bottom, Top, zNear, zFar) {
      var rml = 0.0;
      var tmb = 0.0;
      var fmn = 0.0;
      rml = Right - Left;
      tmb = Top - Bottom;
      fmn = zFar - zNear;
      this.RawComponents[0][0] = 2.0 / rml;
      this.RawComponents[0][1] = 0.0;
      this.RawComponents[0][2] = 0.0;
      this.RawComponents[0][3] = 0.0;
      this.RawComponents[1][0] = 0.0;
      this.RawComponents[1][1] = 2.0 / tmb;
      this.RawComponents[1][2] = 0.0;
      this.RawComponents[1][3] = 0.0;
      this.RawComponents[2][0] = 0.0;
      this.RawComponents[2][1] = 0.0;
      this.RawComponents[2][2] = -2.0 / fmn;
      this.RawComponents[2][3] = 0.0;
      this.RawComponents[3][0] = -(Right + Left) / rml;
      this.RawComponents[3][1] = -(Top + Bottom) / tmb;
      this.RawComponents[3][2] = -(zFar + zNear) / fmn;
      this.RawComponents[3][3] = 1.0;
    };
    this.Multiply = function (m) {
      var Result = null;
      Result = $mod.TMat4.$create("Identity");
      Result.RawComponents[0][0] = (((m.RawComponents[0][0] * this.RawComponents[0][0]) + (m.RawComponents[0][1] * this.RawComponents[1][0])) + (m.RawComponents[0][2] * this.RawComponents[2][0])) + (m.RawComponents[0][3] * this.RawComponents[3][0]);
      Result.RawComponents[0][1] = (((m.RawComponents[0][0] * this.RawComponents[0][1]) + (m.RawComponents[0][1] * this.RawComponents[1][1])) + (m.RawComponents[0][2] * this.RawComponents[2][1])) + (m.RawComponents[0][3] * this.RawComponents[3][1]);
      Result.RawComponents[0][2] = (((m.RawComponents[0][0] * this.RawComponents[0][2]) + (m.RawComponents[0][1] * this.RawComponents[1][2])) + (m.RawComponents[0][2] * this.RawComponents[2][2])) + (m.RawComponents[0][3] * this.RawComponents[3][2]);
      Result.RawComponents[0][3] = (((m.RawComponents[0][0] * this.RawComponents[0][3]) + (m.RawComponents[0][1] * this.RawComponents[1][3])) + (m.RawComponents[0][2] * this.RawComponents[2][3])) + (m.RawComponents[0][3] * this.RawComponents[3][3]);
      Result.RawComponents[1][0] = (((m.RawComponents[1][0] * this.RawComponents[0][0]) + (m.RawComponents[1][1] * this.RawComponents[1][0])) + (m.RawComponents[1][2] * this.RawComponents[2][0])) + (m.RawComponents[1][3] * this.RawComponents[3][0]);
      Result.RawComponents[1][1] = (((m.RawComponents[1][0] * this.RawComponents[0][1]) + (m.RawComponents[1][1] * this.RawComponents[1][1])) + (m.RawComponents[1][2] * this.RawComponents[2][1])) + (m.RawComponents[1][3] * this.RawComponents[3][1]);
      Result.RawComponents[1][2] = (((m.RawComponents[1][0] * this.RawComponents[0][2]) + (m.RawComponents[1][1] * this.RawComponents[1][2])) + (m.RawComponents[1][2] * this.RawComponents[2][2])) + (m.RawComponents[1][3] * this.RawComponents[3][2]);
      Result.RawComponents[1][3] = (((m.RawComponents[1][0] * this.RawComponents[0][3]) + (m.RawComponents[1][1] * this.RawComponents[1][3])) + (m.RawComponents[1][2] * this.RawComponents[2][3])) + (m.RawComponents[1][3] * this.RawComponents[3][3]);
      Result.RawComponents[2][0] = (((m.RawComponents[2][0] * this.RawComponents[0][0]) + (m.RawComponents[2][1] * this.RawComponents[1][0])) + (m.RawComponents[2][2] * this.RawComponents[2][0])) + (m.RawComponents[2][3] * this.RawComponents[3][0]);
      Result.RawComponents[2][1] = (((m.RawComponents[2][0] * this.RawComponents[0][1]) + (m.RawComponents[2][1] * this.RawComponents[1][1])) + (m.RawComponents[2][2] * this.RawComponents[2][1])) + (m.RawComponents[2][3] * this.RawComponents[3][1]);
      Result.RawComponents[2][2] = (((m.RawComponents[2][0] * this.RawComponents[0][2]) + (m.RawComponents[2][1] * this.RawComponents[1][2])) + (m.RawComponents[2][2] * this.RawComponents[2][2])) + (m.RawComponents[2][3] * this.RawComponents[3][2]);
      Result.RawComponents[2][3] = (((m.RawComponents[2][0] * this.RawComponents[0][3]) + (m.RawComponents[2][1] * this.RawComponents[1][3])) + (m.RawComponents[2][2] * this.RawComponents[2][3])) + (m.RawComponents[2][3] * this.RawComponents[3][3]);
      Result.RawComponents[3][0] = (((m.RawComponents[3][0] * this.RawComponents[0][0]) + (m.RawComponents[3][1] * this.RawComponents[1][0])) + (m.RawComponents[3][2] * this.RawComponents[2][0])) + (m.RawComponents[3][3] * this.RawComponents[3][0]);
      Result.RawComponents[3][1] = (((m.RawComponents[3][0] * this.RawComponents[0][1]) + (m.RawComponents[3][1] * this.RawComponents[1][1])) + (m.RawComponents[3][2] * this.RawComponents[2][1])) + (m.RawComponents[3][3] * this.RawComponents[3][1]);
      Result.RawComponents[3][2] = (((m.RawComponents[3][0] * this.RawComponents[0][2]) + (m.RawComponents[3][1] * this.RawComponents[1][2])) + (m.RawComponents[3][2] * this.RawComponents[2][2])) + (m.RawComponents[3][3] * this.RawComponents[3][2]);
      Result.RawComponents[3][3] = (((m.RawComponents[3][0] * this.RawComponents[0][3]) + (m.RawComponents[3][1] * this.RawComponents[1][3])) + (m.RawComponents[3][2] * this.RawComponents[2][3])) + (m.RawComponents[3][3] * this.RawComponents[3][3]);
      return Result;
    };
    this.CopyList = function () {
      var Result = [];
      var x = 0;
      var y = 0;
      var list = null;
      list = new Array();
      for (x = 0; x <= 3; x++) for (y = 0; y <= 3; y++) list.push(this.RawComponents[x][y]);
      Result = list;
      return Result;
    };
  });
  this.SinCos = function (angle, sinus, cosinus) {
    sinus.set(Math.sin(angle));
    cosinus.set(Math.cos(angle));
  };
  $mod.$init = function () {
    $impl.Matrix4x4Identity = $mod.TMat4.$create("Identity");
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.Matrix4x4Identity = null;
});
rtl.module("MemoryBuffer",["System","JS"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass($mod,"TMemoryBuffer",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.byteBuffer = null;
      this.byteOffset = 0;
      this.floatBuffer = null;
    };
    this.$final = function () {
      this.byteBuffer = undefined;
      this.floatBuffer = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (size) {
      this.byteBuffer = new Uint8Array(size);
    };
    this.AddBytes = function (count, data) {
      this.byteBuffer.set(data,this.byteOffset);
      this.byteOffset = this.byteOffset + (count * 1);
    };
    this.AddFloats = function (count, data) {
      var floatOffset = 0;
      floatOffset = Math.floor(this.byteOffset / 4);
      if (this.floatBuffer === null) this.floatBuffer = new Float32Array(this.byteBuffer.buffer,0,Math.floor(this.byteBuffer.byteLength / 4));
      this.floatBuffer.set(data,floatOffset);
      this.byteOffset = this.byteOffset + (count * 4);
    };
  });
});
rtl.module("webgl",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("GLUtils",["System","browserconsole","Web","webgl","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass($mod,"TShader",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.gl = null;
      this.vertexShader = null;
      this.fragmentShader = null;
      this.programID = null;
    };
    this.$final = function () {
      this.gl = undefined;
      this.vertexShader = undefined;
      this.fragmentShader = undefined;
      this.programID = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (context, vertexShaderSource, fragmentShaderSource) {
      this.gl = context;
      this.vertexShader = this.CreateShader(this.gl.VERTEX_SHADER,vertexShaderSource);
      this.fragmentShader = this.CreateShader(this.gl.FRAGMENT_SHADER,fragmentShaderSource);
    };
    this.Compile = function () {
      this.programID = this.gl.createProgram();
      this.gl.attachShader(this.programID,this.vertexShader);
      this.gl.attachShader(this.programID,this.fragmentShader);
    };
    this.Link = function () {
      this.gl.linkProgram(this.programID);
      if (!this.gl.getProgramParameter(this.programID,this.gl.LINK_STATUS)) {
        $impl.Fatal(this.gl.getProgramInfoLog(this.programID));
      };
    };
    this.Use = function () {
      this.gl.useProgram(this.programID);
    };
    this.BindAttribLocation = function (index, name) {
      this.gl.bindAttribLocation(this.programID,index,name);
    };
    this.SetUniformMat4 = function (name, value) {
      var location = null;
      location = this.gl.getUniformLocation(this.programID,name);
      $impl.GLFatal(this.gl,"gl.getUniformLocation");
      this.gl.uniformMatrix4fv(location,false,value);
      $impl.GLFatal(this.gl,"gl.uniformMatrix4fv");
    };
    this.CreateShader = function (theType, source) {
      var Result = null;
      var shader = null;
      shader = this.gl.createShader(theType);
      if (shader === null) $impl.Fatal("create shader failed");
      this.gl.shaderSource(shader,source);
      this.gl.compileShader(shader);
      if (this.gl.getShaderParameter(shader,this.gl.COMPILE_STATUS)) {
        return shader;
      } else {
        $impl.Fatal$1(this.gl.getShaderInfoLog(shader));
      };
      return Result;
    };
  });
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.Fatal = function (messageString) {
    pas.System.Writeln("*** FATAL: ",messageString);
    return;
  };
  $impl.Fatal$1 = function (messageString) {
    pas.System.Writeln("*** FATAL: ",messageString);
    return;
  };
  $impl.GLFatal = function (gl, messageString) {
    var error = 0;
    error = gl.getError();
    if (error !== gl.NO_ERROR) {
      $impl.Fatal(messageString);
    };
  };
});
rtl.module("GLTypes",["System","webgl","JS"],function () {
  "use strict";
  var $mod = this;
  this.TVec2_Sizeof = function () {
    var Result = 0;
    Result = 4 * 2;
    return Result;
  };
  this.TRGBAb_Sizeof = function () {
    var Result = 0;
    Result = 1 * 4;
    return Result;
  };
  this.V2 = function (x, y) {
    var Result = [];
    Result[0] = x;
    Result[1] = y;
    return Result;
  };
  this.RGBAb = function (r, g, b, a) {
    var Result = [];
    Result[0] = r;
    Result[1] = g;
    Result[2] = b;
    Result[3] = a;
    return Result;
  };
});
rtl.module("program",["System","Mat4","MemoryBuffer","GLUtils","GLTypes","browserconsole","Web","webgl","JS","math"],function () {
  "use strict";
  var $mod = this;
  this.GLVertex2 = function (s) {
    if (s) {
      this.pos = s.pos;
      this.color = s.color;
    } else {
      this.pos = [];
      this.color = [];
    };
    this.$equal = function (b) {
      return (this.pos === b.pos) && (this.color === b.color);
    };
  };
  this.kSIZEOF_VERTEX = 12;
  this.GetVertexData = function () {
    var Result = null;
    var buffer = null;
    var verts = null;
    var v = new $mod.GLVertex2();
    var i = 0;
    verts = new Array();
    v.pos = pas.GLTypes.V2(0,0);
    v.color = pas.GLTypes.RGBAb(255,0,0,255);
    verts.push(new $mod.GLVertex2(v));
    v.pos = pas.GLTypes.V2(0,100);
    v.color = pas.GLTypes.RGBAb(0,255,0,255);
    verts.push(new $mod.GLVertex2(v));
    v.pos = pas.GLTypes.V2(100,100);
    v.color = pas.GLTypes.RGBAb(0,0,255,255);
    verts.push(new $mod.GLVertex2(v));
    buffer = pas.MemoryBuffer.TMemoryBuffer.$create("Create$1",[12 * verts.length]);
    for (var $l1 = 0, $end2 = verts.length - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      v = new $mod.GLVertex2(rtl.getObject(verts[i]));
      buffer.AddFloats(2,v.pos);
      buffer.AddBytes(4,v.color);
    };
    Result = buffer.byteBuffer;
    return Result;
  };
  this.nextTime = 0;
  this.deltaTime = 0;
  this.gl = null;
  this.shader = null;
  this.projTransform = null;
  this.viewTransform = null;
  this.modelTransform = null;
  this.rotateAngle = 0;
  this.UpdateCanvas = function (time) {
    var now = 0.0;
    var list = [];
    now = time * 0.001;
    $mod.deltaTime = now - $mod.nextTime;
    $mod.nextTime = now;
    $mod.modelTransform = pas.Mat4.TMat4.$create("Identity");
    $mod.modelTransform = $mod.modelTransform.Multiply(pas.Mat4.TMat4.$create("Translate",[100,100,0]));
    $mod.modelTransform = $mod.modelTransform.Multiply(pas.Mat4.TMat4.$create("RotateZ",[pas.math.DegToRad($mod.rotateAngle)]));
    $mod.rotateAngle = $mod.rotateAngle + (20 * $mod.deltaTime);
    list = $mod.modelTransform.CopyList();
    $mod.shader.SetUniformMat4("modelTransform",list);
    $mod.gl.clear($mod.gl.COLOR_BUFFER_BIT);
    $mod.gl.drawArrays($mod.gl.TRIANGLES,0,3);
    window.requestAnimationFrame($mod.UpdateCanvas);
  };
  this.canvas = null;
  this.offset = 0;
  this.stride = 0;
  this.vertexShaderSource = "";
  this.fragmentShaderSource = "";
  this.buffer = null;
  this.list = [];
  $mod.$main = function () {
    $mod.canvas = document.createElement("canvas");
    $mod.canvas.width = 300;
    $mod.canvas.height = 300;
    document.body.appendChild($mod.canvas);
    $mod.gl = $mod.canvas.getContext("webgl");
    if ($mod.gl === null) {
      pas.System.Writeln("failed to load webgl!");
      return;
    };
    $mod.vertexShaderSource = document.getElementById("vertex.glsl").textContent;
    $mod.fragmentShaderSource = document.getElementById("fragment.glsl").textContent;
    $mod.shader = pas.GLUtils.TShader.$create("Create$1",[$mod.gl,$mod.vertexShaderSource,$mod.fragmentShaderSource]);
    $mod.shader.Compile();
    $mod.shader.BindAttribLocation(0,"in_position");
    $mod.shader.BindAttribLocation(1,"in_color");
    $mod.shader.Link();
    $mod.shader.Use();
    $mod.gl.clearColor(0.9,0.9,0.9,1);
    $mod.gl.viewport(0,0,$mod.canvas.width,$mod.canvas.height);
    $mod.gl.clear($mod.gl.COLOR_BUFFER_BIT);
    $mod.projTransform = pas.Mat4.TMat4.$create("Ortho",[0,$mod.gl.canvas.width,$mod.gl.canvas.height,0,-1,1]);
    $mod.viewTransform = pas.Mat4.TMat4.$create("Identity");
    $mod.modelTransform = pas.Mat4.TMat4.$create("Identity");
    $mod.list = $mod.projTransform.CopyList();
    $mod.shader.SetUniformMat4("projTransform",$mod.list);
    $mod.list = $mod.viewTransform.CopyList();
    $mod.shader.SetUniformMat4("viewTransform",$mod.list);
    $mod.list = $mod.modelTransform.CopyList();
    $mod.shader.SetUniformMat4("modelTransform",$mod.list);
    $mod.buffer = $mod.gl.createBuffer();
    $mod.gl.bindBuffer($mod.gl.ARRAY_BUFFER,$mod.buffer);
    $mod.gl.bufferData($mod.gl.ARRAY_BUFFER,$mod.GetVertexData(),$mod.gl.STATIC_DRAW);
    $mod.offset = 0;
    $mod.stride = 12;
    $mod.gl.enableVertexAttribArray(0);
    $mod.gl.vertexAttribPointer(0,2,$mod.gl.FLOAT,false,$mod.stride,$mod.offset);
    $mod.offset = $mod.offset + pas.GLTypes.TVec2_Sizeof();
    $mod.gl.enableVertexAttribArray(1);
    $mod.gl.vertexAttribPointer(1,4,$mod.gl.UNSIGNED_BYTE,true,$mod.stride,$mod.offset);
    $mod.offset = $mod.offset + pas.GLTypes.TRGBAb_Sizeof();
    window.requestAnimationFrame($mod.UpdateCanvas);
  };
});
