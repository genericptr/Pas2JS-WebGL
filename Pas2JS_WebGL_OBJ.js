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
        t.$module = this.$module;
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
  this.Trunc = function (A) {
    if (!Math.trunc) {
      Math.trunc = function(v) {
        v = +v;
        if (!isFinite(v)) return v;
        return (v - v % 1) || (v < 0 ? -0 : v === 0 ? v : 0);
      };
    }
    $mod.Trunc = Math.trunc;
    return Math.trunc(A);
  };
  this.Int = function (A) {
    var Result = 0.0;
    Result = Math.trunc(A);
    return Result;
  };
  this.Copy = function (S, Index, Size) {
    if (Index<1) Index = 1;
    return (Size>0) ? S.substring(Index-1,Index+Size-1) : "";
  };
  this.Copy$1 = function (S, Index) {
    if (Index<1) Index = 1;
    return S.substr(Index-1);
  };
  this.Delete = function (S, Index, Size) {
    var h = "";
    if (((Index < 1) || (Index > S.get().length)) || (Size <= 0)) return;
    h = S.get();
    S.set($mod.Copy(h,1,Index - 1) + $mod.Copy$1(h,Index + Size));
  };
  this.Pos = function (Search, InString) {
    return InString.indexOf(Search)+1;
  };
  this.Insert = function (Insertion, Target, Index) {
    var t = "";
    if (Insertion === "") return;
    t = Target.get();
    if (Index < 1) {
      Target.set(Insertion + t)}
     else if (Index > t.length) {
      Target.set(t + Insertion)}
     else Target.set(($mod.Copy(t,1,Index - 1) + Insertion) + $mod.Copy(t,Index,t.length));
  };
  this.upcase = function (c) {
    return c.toUpperCase();
  };
  this.val = function (S, NI, Code) {
    var x = 0.0;
    Code.set(0);
    x = Number(S);
    if (isNaN(x) || (x !== $mod.Int(x))) {
      Code.set(1)}
     else NI.set($mod.Trunc(x));
  };
  this.StringOfChar = function (c, l) {
    var Result = "";
    var i = 0;
    Result = "";
    for (var $l1 = 1, $end2 = l; $l1 <= $end2; $l1++) {
      i = $l1;
      Result = Result + c;
    };
    return Result;
  };
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
rtl.module("Types",["System"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("JS",["System","Types"],function () {
  "use strict";
  var $mod = this;
  this.isInteger = function (v) {
    return Math.floor(v)===v;
  };
  this.isNull = function (v) {
    return v === null;
  };
  this.TJSValueType = {"0": "jvtNull", jvtNull: 0, "1": "jvtBoolean", jvtBoolean: 1, "2": "jvtInteger", jvtInteger: 2, "3": "jvtFloat", jvtFloat: 3, "4": "jvtString", jvtString: 4, "5": "jvtObject", jvtObject: 5, "6": "jvtArray", jvtArray: 6};
  this.GetValueType = function (JS) {
    var Result = 0;
    var t = "";
    if ($mod.isNull(JS)) {
      Result = $mod.TJSValueType.jvtNull}
     else {
      t = typeof(JS);
      if (t === "string") {
        Result = $mod.TJSValueType.jvtString}
       else if (t === "boolean") {
        Result = $mod.TJSValueType.jvtBoolean}
       else if (t === "object") {
        if (rtl.isArray(JS)) {
          Result = $mod.TJSValueType.jvtArray}
         else Result = $mod.TJSValueType.jvtObject;
      } else if (t === "number") if ($mod.isInteger(JS)) {
        Result = $mod.TJSValueType.jvtInteger}
       else Result = $mod.TJSValueType.jvtFloat;
    };
    return Result;
  };
});
rtl.module("Web",["System","Types","JS"],function () {
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
rtl.module("RTLConsts",["System"],function () {
  "use strict";
  var $mod = this;
  this.SArgumentMissing = 'Missing argument in format "%s"';
  this.SInvalidFormat = 'Invalid format specifier : "%s"';
  this.SInvalidArgIndex = 'Invalid argument index in format: "%s"';
  this.SErrInvalidInteger = 'Invalid integer value: "%s"';
  this.SErrInvalidFloat = 'Invalid floating-point value: "%s"';
});
rtl.module("SysUtils",["System","RTLConsts","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass($mod,"Exception",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fMessage = "";
    };
    this.CreateFmt = function (Msg, Args) {
      this.fMessage = $mod.Format(Msg,Args);
    };
  });
  rtl.createClass($mod,"EConvertError",$mod.Exception,function () {
  });
  this.TrimLeft = function (S) {
    return S.replace(/^[\s\uFEFF\xA0\x00-\x1f]+/,'');
  };
  this.Format = function (Fmt, Args) {
    var Result = "";
    var ChPos = 0;
    var OldPos = 0;
    var ArgPos = 0;
    var DoArg = 0;
    var Len = 0;
    var Hs = "";
    var ToAdd = "";
    var Index = 0;
    var Width = 0;
    var Prec = 0;
    var Left = false;
    var Fchar = "";
    var vq = 0;
    function ReadFormat() {
      var Result = "";
      var Value = 0;
      function ReadInteger() {
        var Code = 0;
        var ArgN = 0;
        if (Value !== -1) return;
        OldPos = ChPos;
        while (((ChPos <= Len) && (Fmt.charAt(ChPos - 1) <= "9")) && (Fmt.charAt(ChPos - 1) >= "0")) ChPos += 1;
        if (ChPos > Len) $impl.DoFormatError(1,Fmt);
        if (Fmt.charAt(ChPos - 1) === "*") {
          if (Index === -1) {
            ArgN = ArgPos}
           else {
            ArgN = Index;
            Index += 1;
          };
          if ((ChPos > OldPos) || (ArgN > (rtl.length(Args) - 1))) $impl.DoFormatError(1,Fmt);
          ArgPos = ArgN + 1;
          if (rtl.isNumber(Args[ArgN]) && pas.JS.isInteger(Args[ArgN])) {
            Value = Math.floor(Args[ArgN])}
           else $impl.DoFormatError(1,Fmt);
          ChPos += 1;
        } else {
          if (OldPos < ChPos) {
            pas.System.val(pas.System.Copy(Fmt,OldPos,ChPos - OldPos),{get: function () {
                return Value;
              }, set: function (v) {
                Value = v;
              }},{get: function () {
                return Code;
              }, set: function (v) {
                Code = v;
              }});
            if (Code > 0) $impl.DoFormatError(1,Fmt);
          } else Value = -1;
        };
      };
      function ReadIndex() {
        if (Fmt.charAt(ChPos - 1) !== ":") {
          ReadInteger()}
         else Value = 0;
        if (Fmt.charAt(ChPos - 1) === ":") {
          if (Value === -1) $impl.DoFormatError(2,Fmt);
          Index = Value;
          Value = -1;
          ChPos += 1;
        };
      };
      function ReadLeft() {
        if (Fmt.charAt(ChPos - 1) === "-") {
          Left = true;
          ChPos += 1;
        } else Left = false;
      };
      function ReadWidth() {
        ReadInteger();
        if (Value !== -1) {
          Width = Value;
          Value = -1;
        };
      };
      function ReadPrec() {
        if (Fmt.charAt(ChPos - 1) === ".") {
          ChPos += 1;
          ReadInteger();
          if (Value === -1) Value = 0;
          Prec = Value;
        };
      };
      Index = -1;
      Width = -1;
      Prec = -1;
      Value = -1;
      ChPos += 1;
      if (Fmt.charAt(ChPos - 1) === "%") {
        Result = "%";
        return Result;
      };
      ReadIndex();
      ReadLeft();
      ReadWidth();
      ReadPrec();
      Result = pas.System.upcase(Fmt.charAt(ChPos - 1));
      return Result;
    };
    function Checkarg(AT, err) {
      var Result = false;
      Result = false;
      if (Index === -1) {
        DoArg = ArgPos}
       else DoArg = Index;
      ArgPos = DoArg + 1;
      if ((DoArg > (rtl.length(Args) - 1)) || (pas.JS.GetValueType(Args[DoArg]) !== AT)) {
        if (err) $impl.DoFormatError(3,Fmt);
        ArgPos -= 1;
        return Result;
      };
      Result = true;
      return Result;
    };
    Result = "";
    Len = Fmt.length;
    ChPos = 1;
    OldPos = 1;
    ArgPos = 0;
    while (ChPos <= Len) {
      while ((ChPos <= Len) && (Fmt.charAt(ChPos - 1) !== "%")) ChPos += 1;
      if (ChPos > OldPos) Result = Result + pas.System.Copy(Fmt,OldPos,ChPos - OldPos);
      if (ChPos < Len) {
        Fchar = ReadFormat();
        var $tmp1 = Fchar;
        if ($tmp1 === "D") {
          Checkarg(pas.JS.TJSValueType.jvtInteger,true);
          ToAdd = $mod.IntToStr(Math.floor(Args[DoArg]));
          Width = Math.abs(Width);
          Index = Prec - ToAdd.length;
          if (ToAdd.charAt(0) !== "-") {
            ToAdd = pas.System.StringOfChar("0",Index) + ToAdd}
           else pas.System.Insert(pas.System.StringOfChar("0",Index + 1),{get: function () {
              return ToAdd;
            }, set: function (v) {
              ToAdd = v;
            }},2);
        } else if ($tmp1 === "U") {
          Checkarg(pas.JS.TJSValueType.jvtInteger,true);
          if (Math.floor(Args[DoArg]) < 0) $impl.DoFormatError(3,Fmt);
          ToAdd = $mod.IntToStr(Math.floor(Args[DoArg]));
          Width = Math.abs(Width);
          Index = Prec - ToAdd.length;
          ToAdd = pas.System.StringOfChar("0",Index) + ToAdd;
        } else if ($tmp1 === "E") {
          if (Checkarg(pas.JS.TJSValueType.jvtFloat,false) || Checkarg(pas.JS.TJSValueType.jvtInteger,true)) ToAdd = $mod.FloatToStrF(rtl.getNumber(Args[DoArg]),$mod.TFloatFormat.ffFixed,9999,Prec);
        } else if ($tmp1 === "F") {
          if (Checkarg(pas.JS.TJSValueType.jvtFloat,false) || Checkarg(pas.JS.TJSValueType.jvtInteger,true)) ToAdd = $mod.FloatToStrF(rtl.getNumber(Args[DoArg]),$mod.TFloatFormat.ffFixed,9999,Prec);
        } else if ($tmp1 === "G") {
          if (Checkarg(pas.JS.TJSValueType.jvtFloat,false) || Checkarg(pas.JS.TJSValueType.jvtInteger,true)) ToAdd = $mod.FloatToStrF(rtl.getNumber(Args[DoArg]),$mod.TFloatFormat.ffGeneral,Prec,3);
        } else if ($tmp1 === "N") {
          if (Checkarg(pas.JS.TJSValueType.jvtFloat,false) || Checkarg(pas.JS.TJSValueType.jvtInteger,true)) ToAdd = $mod.FloatToStrF(rtl.getNumber(Args[DoArg]),$mod.TFloatFormat.ffNumber,9999,Prec);
        } else if ($tmp1 === "M") {
          if (Checkarg(pas.JS.TJSValueType.jvtFloat,false) || Checkarg(pas.JS.TJSValueType.jvtInteger,true)) ToAdd = $mod.FloatToStrF(rtl.getNumber(Args[DoArg]),$mod.TFloatFormat.ffCurrency,9999,Prec);
        } else if ($tmp1 === "S") {
          Checkarg(pas.JS.TJSValueType.jvtString,true);
          Hs = "" + Args[DoArg];
          Index = Hs.length;
          if ((Prec !== -1) && (Index > Prec)) Index = Prec;
          ToAdd = pas.System.Copy(Hs,1,Index);
        } else if ($tmp1 === "P") {
          Checkarg(pas.JS.TJSValueType.jvtInteger,true);
          ToAdd = $mod.IntToHex(Math.floor(Args[DoArg]),31);
        } else if ($tmp1 === "X") {
          Checkarg(pas.JS.TJSValueType.jvtInteger,true);
          vq = Math.floor(Args[DoArg]);
          Index = 31;
          if (Prec > Index) {
            ToAdd = $mod.IntToHex(vq,Index)}
           else {
            Index = 1;
            while (((1 << (Index * 4)) <= vq) && (Index < 16)) Index += 1;
            if (Index > Prec) Prec = Index;
            ToAdd = $mod.IntToHex(vq,Prec);
          };
        } else if ($tmp1 === "%") ToAdd = "%";
        if (Width !== -1) if (ToAdd.length < Width) if (!Left) {
          ToAdd = pas.System.StringOfChar(" ",Width - ToAdd.length) + ToAdd}
         else ToAdd = ToAdd + pas.System.StringOfChar(" ",Width - ToAdd.length);
        Result = Result + ToAdd;
      };
      ChPos += 1;
      OldPos = ChPos;
    };
    return Result;
  };
  this.TStringReplaceFlag = {"0": "rfReplaceAll", rfReplaceAll: 0, "1": "rfIgnoreCase", rfIgnoreCase: 1};
  this.StringReplace = function (aOriginal, aSearch, aReplace, Flags) {
    var Result = "";
    var REFlags = "";
    var REString = "";
    REFlags = "";
    if ($mod.TStringReplaceFlag.rfReplaceAll in Flags) REFlags = "g";
    if ($mod.TStringReplaceFlag.rfIgnoreCase in Flags) REFlags = REFlags + "i";
    REString = aSearch.replace(new RegExp($impl.RESpecials,"g"),"\\$1");
    Result = aOriginal.replace(new RegExp(REString,REFlags),aReplace);
    return Result;
  };
  this.IntToStr = function (Value) {
    var Result = "";
    Result = "" + Value;
    return Result;
  };
  this.TryStrToInt$1 = function (S, res) {
    var Result = false;
    var Radix = 10;
    var F = "";
    var N = "";
    var J = undefined;
    N = S;
    F = pas.System.Copy(N,1,1);
    if (F === "$") {
      Radix = 16}
     else if (F === "&") {
      Radix = 8}
     else if (F === "%") Radix = 2;
    if (Radix !== 10) pas.System.Delete({get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},1,1);
    J = parseInt(N,Radix);
    Result = !isNaN(J);
    if (Result) res.set(Math.floor(J));
    return Result;
  };
  this.StrToInt = function (S) {
    var Result = 0;
    var R = 0;
    if (!$mod.TryStrToInt$1(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidInteger,[S]]);
    Result = R;
    return Result;
  };
  var HexDigits = "0123456789ABCDEF";
  this.IntToHex = function (Value, Digits) {
    var Result = "";
    if (Digits === 0) Digits = 1;
    Result = "";
    while (Value > 0) {
      Result = HexDigits.charAt(((Value & 15) + 1) - 1) + Result;
      Value = Value >>> 4;
    };
    while (Result.length < Digits) Result = "0" + Result;
    return Result;
  };
  this.TFloatFormat = {"0": "ffFixed", ffFixed: 0, "1": "ffGeneral", ffGeneral: 1, "2": "ffExponent", ffExponent: 2, "3": "ffNumber", ffNumber: 3, "4": "ffCurrency", ffCurrency: 4};
  this.FloatToStrF = function (Value, format, Precision, Digits) {
    var Result = "";
    var DS = "";
    DS = $mod.DecimalSeparator;
    var $tmp1 = format;
    if ($tmp1 === $mod.TFloatFormat.ffGeneral) {
      Result = $impl.FormatGeneralFloat(Value,Precision,DS)}
     else if ($tmp1 === $mod.TFloatFormat.ffExponent) {
      Result = $impl.FormatExponentFloat(Value,Precision,Digits,DS)}
     else if ($tmp1 === $mod.TFloatFormat.ffFixed) {
      Result = $impl.FormatFixedFloat(Value,Digits,DS)}
     else if ($tmp1 === $mod.TFloatFormat.ffNumber) {
      Result = $impl.FormatNumberFloat(Value,Digits,DS,$mod.ThousandSeparator)}
     else if ($tmp1 === $mod.TFloatFormat.ffCurrency) Result = $impl.FormatNumberCurrency(Value * 10000,Digits,DS,$mod.ThousandSeparator);
    if (((format !== $mod.TFloatFormat.ffCurrency) && (Result.length > 1)) && (Result.charAt(0) === "-")) $impl.RemoveLeadingNegativeSign({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},DS);
    return Result;
  };
  this.TryStrToFloat = function (S, res) {
    var Result = false;
    var J = undefined;
    var N = "";
    N = S;
    if ($mod.ThousandSeparator !== "") N = $mod.StringReplace(N,$mod.ThousandSeparator,"",rtl.createSet($mod.TStringReplaceFlag.rfReplaceAll));
    if ($mod.DecimalSeparator !== ".") N = $mod.StringReplace(N,$mod.DecimalSeparator,".",{});
    J = parseFloat(N);
    Result = !isNaN(J);
    if (Result) res.set(rtl.getNumber(J));
    return Result;
  };
  this.StrToFloat = function (S) {
    var Result = 0.0;
    if (!$mod.TryStrToFloat(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidFloat,[S]]);
    return Result;
  };
  this.DecimalSeparator = ".";
  this.ThousandSeparator = "";
  rtl.createClass($mod,"TFormatSettings",pas.System.TObject,function () {
    this.GetThousandSeparator = function () {
      var Result = "";
      Result = $mod.ThousandSeparator;
      return Result;
    };
  });
  this.FormatSettings = null;
  this.CurrencyFormat = 0;
  this.NegCurrFormat = 0;
  this.CurrencyDecimals = 2;
  this.CurrencyString = "$";
  $mod.$init = function () {
    $mod.FormatSettings = $mod.TFormatSettings.$create("Create");
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.feInvalidFormat = 1;
  $impl.feMissingArgument = 2;
  $impl.feInvalidArgIndex = 3;
  $impl.DoFormatError = function (ErrCode, fmt) {
    var $tmp1 = ErrCode;
    if ($tmp1 === 1) {
      throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SInvalidFormat,[fmt]])}
     else if ($tmp1 === 2) {
      throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SArgumentMissing,[fmt]])}
     else if ($tmp1 === 3) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SInvalidArgIndex,[fmt]]);
  };
  $impl.maxdigits = 15;
  $impl.ReplaceDecimalSep = function (S, DS) {
    var Result = "";
    var P = 0;
    P = pas.System.Pos(".",S);
    if (P > 0) {
      Result = (pas.System.Copy(S,1,P - 1) + DS) + pas.System.Copy(S,P + 1,S.length - P)}
     else Result = S;
    return Result;
  };
  $impl.FormatGeneralFloat = function (Value, Precision, DS) {
    var Result = "";
    var P = 0;
    var PE = 0;
    var Q = 0;
    var Exponent = 0;
    if ((Precision === -1) || (Precision > 15)) Precision = 15;
    Result = rtl.floatToStr(Value,Precision + 7);
    Result = $mod.TrimLeft(Result);
    P = pas.System.Pos(".",Result);
    if (P === 0) return Result;
    PE = pas.System.Pos("E",Result);
    if (PE === 0) {
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    Q = PE + 2;
    Exponent = 0;
    while (Q <= Result.length) {
      Exponent = ((Exponent * 10) + Result.charCodeAt(Q - 1)) - "0".charCodeAt();
      Q += 1;
    };
    if (Result.charAt((PE + 1) - 1) === "-") Exponent = -Exponent;
    if (((P + Exponent) < PE) && (Exponent > -6)) {
      Result = rtl.strSetLength(Result,PE - 1);
      if (Exponent >= 0) {
        for (var $l1 = 0, $end2 = Exponent - 1; $l1 <= $end2; $l1++) {
          Q = $l1;
          Result = rtl.setCharAt(Result,P - 1,Result.charAt((P + 1) - 1));
          P += 1;
        };
        Result = rtl.setCharAt(Result,P - 1,".");
        P = 1;
        if (Result.charAt(P - 1) === "-") P += 1;
        while (((Result.charAt(P - 1) === "0") && (P < Result.length)) && (pas.System.Copy(Result,P + 1,DS.length) !== DS)) pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P,1);
      } else {
        pas.System.Insert(pas.System.Copy("00000",1,-Exponent),{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P - 1);
        Result = rtl.setCharAt(Result,(P - Exponent) - 1,Result.charAt(((P - Exponent) - 1) - 1));
        Result = rtl.setCharAt(Result,P - 1,".");
        if (Exponent !== -1) Result = rtl.setCharAt(Result,((P - Exponent) - 1) - 1,"0");
      };
      Q = Result.length;
      while ((Q > 0) && (Result.charAt(Q - 1) === "0")) Q -= 1;
      if (Result.charAt(Q - 1) === ".") Q -= 1;
      if ((Q === 0) || ((Q === 1) && (Result.charAt(0) === "-"))) {
        Result = "0"}
       else Result = rtl.strSetLength(Result,Q);
    } else {
      while (Result.charAt((PE - 1) - 1) === "0") {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},PE - 1,1);
        PE -= 1;
      };
      if (Result.charAt((PE - 1) - 1) === DS) {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},PE - 1,1);
        PE -= 1;
      };
      if (Result.charAt((PE + 1) - 1) === "+") {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},PE + 1,1)}
       else PE += 1;
      while (Result.charAt((PE + 1) - 1) === "0") pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},PE + 1,1);
    };
    Result = $impl.ReplaceDecimalSep(Result,DS);
    return Result;
  };
  $impl.FormatExponentFloat = function (Value, Precision, Digits, DS) {
    var Result = "";
    var P = 0;
    DS = $mod.DecimalSeparator;
    if ((Precision === -1) || (Precision > 15)) Precision = 15;
    Result = rtl.floatToStr(Value,Precision + 7);
    while (Result.charAt(0) === " ") pas.System.Delete({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},1,1);
    P = pas.System.Pos("E",Result);
    if (P === 0) {
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    P += 2;
    if (Digits > 4) Digits = 4;
    Digits = ((Result.length - P) - Digits) + 1;
    if (Digits < 0) {
      pas.System.Insert(pas.System.Copy("0000",1,-Digits),{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},P)}
     else while ((Digits > 0) && (Result.charAt(P - 1) === "0")) {
      pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},P,1);
      if (P > Result.length) {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P - 2,2);
        break;
      };
      Digits -= 1;
    };
    Result = $impl.ReplaceDecimalSep(Result,DS);
    return Result;
  };
  $impl.FormatFixedFloat = function (Value, Digits, DS) {
    var Result = "";
    if (Digits === -1) {
      Digits = 2}
     else if (Digits > 18) Digits = 18;
    Result = rtl.floatToStr(Value,0,Digits);
    if ((Result !== "") && (Result.charAt(0) === " ")) pas.System.Delete({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},1,1);
    Result = $impl.ReplaceDecimalSep(Result,DS);
    return Result;
  };
  $impl.FormatNumberFloat = function (Value, Digits, DS, TS) {
    var Result = "";
    var P = 0;
    if (Digits === -1) {
      Digits = 2}
     else if (Digits > 15) Digits = 15;
    Result = rtl.floatToStr(Value,0,Digits);
    if ((Result !== "") && (Result.charAt(0) === " ")) pas.System.Delete({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},1,1);
    P = pas.System.Pos(".",Result);
    Result = $impl.ReplaceDecimalSep(Result,DS);
    P -= 3;
    if ((TS !== "") && (TS !== "\x00")) while (P > 1) {
      if (Result.charAt((P - 1) - 1) !== "-") pas.System.Insert(TS,{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},P);
      P -= 3;
    };
    return Result;
  };
  $impl.RemoveLeadingNegativeSign = function (AValue, DS) {
    var Result = false;
    var i = 0;
    var TS = "";
    var StartPos = 0;
    Result = false;
    StartPos = 2;
    TS = $mod.ThousandSeparator;
    for (var $l1 = StartPos, $end2 = AValue.get().length; $l1 <= $end2; $l1++) {
      i = $l1;
      Result = (AValue.get().charCodeAt(i - 1) in rtl.createSet(48,DS.charCodeAt(),69,43)) || (AValue.get() === TS);
      if (!Result) break;
    };
    if (Result) pas.System.Delete(AValue,1,1);
    return Result;
  };
  $impl.FormatNumberCurrency = function (Value, Digits, DS, TS) {
    var Result = "";
    var Negative = false;
    var P = 0;
    if (Digits === -1) {
      Digits = $mod.CurrencyDecimals}
     else if (Digits > 18) Digits = 18;
    Result = rtl.spaceLeft("" + Value,0);
    Negative = Result.charAt(0) === "-";
    if (Negative) pas.System.Delete({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},1,1);
    P = pas.System.Pos(".",Result);
    if (P !== 0) {
      Result = $impl.ReplaceDecimalSep(Result,DS)}
     else P = Result.length + 1;
    P -= 3;
    while (P > 1) {
      if ($mod.ThousandSeparator !== "\x00") pas.System.Insert($mod.FormatSettings.GetThousandSeparator(),{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},P);
      P -= 3;
    };
    if ((Result.length > 1) && Negative) Negative = !$impl.RemoveLeadingNegativeSign({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},DS);
    if (!Negative) {
      var $tmp1 = $mod.CurrencyFormat;
      if ($tmp1 === 0) {
        Result = $mod.CurrencyString + Result}
       else if ($tmp1 === 1) {
        Result = Result + $mod.CurrencyString}
       else if ($tmp1 === 2) {
        Result = ($mod.CurrencyString + " ") + Result}
       else if ($tmp1 === 3) Result = (Result + " ") + $mod.CurrencyString;
    } else {
      var $tmp2 = $mod.NegCurrFormat;
      if ($tmp2 === 0) {
        Result = (("(" + $mod.CurrencyString) + Result) + ")"}
       else if ($tmp2 === 1) {
        Result = ("-" + $mod.CurrencyString) + Result}
       else if ($tmp2 === 2) {
        Result = ($mod.CurrencyString + "-") + Result}
       else if ($tmp2 === 3) {
        Result = ($mod.CurrencyString + Result) + "-"}
       else if ($tmp2 === 4) {
        Result = (("(" + Result) + $mod.CurrencyString) + ")"}
       else if ($tmp2 === 5) {
        Result = ("-" + Result) + $mod.CurrencyString}
       else if ($tmp2 === 6) {
        Result = (Result + "-") + $mod.CurrencyString}
       else if ($tmp2 === 7) {
        Result = (Result + $mod.CurrencyString) + "-"}
       else if ($tmp2 === 8) {
        Result = (("-" + Result) + " ") + $mod.CurrencyString}
       else if ($tmp2 === 9) {
        Result = (("-" + $mod.CurrencyString) + " ") + Result}
       else if ($tmp2 === 10) {
        Result = ((Result + " ") + $mod.CurrencyString) + "-"}
       else if ($tmp2 === 11) {
        Result = (($mod.CurrencyString + " ") + Result) + "-"}
       else if ($tmp2 === 12) {
        Result = (($mod.CurrencyString + " ") + "-") + Result}
       else if ($tmp2 === 13) {
        Result = ((Result + "-") + " ") + $mod.CurrencyString}
       else if ($tmp2 === 14) {
        Result = ((("(" + $mod.CurrencyString) + " ") + Result) + ")"}
       else if ($tmp2 === 15) Result = ((("(" + Result) + " ") + $mod.CurrencyString) + ")";
    };
    if (TS === "") ;
    return Result;
  };
  $impl.RESpecials = "([\\[\\]\\(\\)\\\\\\.\\*])";
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
    this.RotateY = function (Angle) {
      $mod.SinCos(Angle,{a: 0, p: this.RawComponents[2], get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }},{a: 0, p: this.RawComponents[0], get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }});
      this.RawComponents[0][1] = 0.0;
      this.RawComponents[0][2] = -this.RawComponents[2][0];
      this.RawComponents[0][3] = 0.0;
      this.RawComponents[1][0] = 0.0;
      this.RawComponents[1][1] = 1.0;
      this.RawComponents[1][2] = 0.0;
      this.RawComponents[1][3] = 0.0;
      this.RawComponents[2][1] = 0.0;
      this.RawComponents[2][2] = this.RawComponents[0][0];
      this.RawComponents[2][3] = 0.0;
      this.RawComponents[3][0] = 0.0;
      this.RawComponents[3][1] = 0.0;
      this.RawComponents[3][2] = 0.0;
      this.RawComponents[3][3] = 1.0;
    };
    this.Perspective = function (fovy, Aspect, zNear, zFar) {
      var Sine = 0.0;
      var Cotangent = 0.0;
      var ZDelta = 0.0;
      var Radians = 0.0;
      Radians = (fovy * 0.5) * 0.017453292519944444;
      ZDelta = zFar - zNear;
      Sine = Math.sin(Radians);
      if (!(((ZDelta === 0) || (Sine === 0)) || (Aspect === 0))) {
        Cotangent = Math.cos(Radians) / Sine;
        this.RawComponents = $impl.Matrix4x4Identity.RawComponents.slice(0);
        this.RawComponents[0][0] = Cotangent / Aspect;
        this.RawComponents[1][1] = Cotangent;
        this.RawComponents[2][2] = -(zFar + zNear) / ZDelta;
        this.RawComponents[2][3] = -1 - 0;
        this.RawComponents[3][2] = -((2.0 * zNear) * zFar) / ZDelta;
        this.RawComponents[3][3] = 0.0;
      };
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
    this.Inverse = function () {
      var Result = null;
      var t0 = 0.0;
      var t4 = 0.0;
      var t8 = 0.0;
      var t12 = 0.0;
      var d = 0.0;
      t0 = ((((((this.RawComponents[1][1] * this.RawComponents[2][2]) * this.RawComponents[3][3]) - ((this.RawComponents[1][1] * this.RawComponents[2][3]) * this.RawComponents[3][2])) - ((this.RawComponents[2][1] * this.RawComponents[1][2]) * this.RawComponents[3][3])) + ((this.RawComponents[2][1] * this.RawComponents[1][3]) * this.RawComponents[3][2])) + ((this.RawComponents[3][1] * this.RawComponents[1][2]) * this.RawComponents[2][3])) - ((this.RawComponents[3][1] * this.RawComponents[1][3]) * this.RawComponents[2][2]);
      t4 = ((((-((this.RawComponents[1][0] * this.RawComponents[2][2]) * this.RawComponents[3][3]) + ((this.RawComponents[1][0] * this.RawComponents[2][3]) * this.RawComponents[3][2])) + ((this.RawComponents[2][0] * this.RawComponents[1][2]) * this.RawComponents[3][3])) - ((this.RawComponents[2][0] * this.RawComponents[1][3]) * this.RawComponents[3][2])) - ((this.RawComponents[3][0] * this.RawComponents[1][2]) * this.RawComponents[2][3])) + ((this.RawComponents[3][0] * this.RawComponents[1][3]) * this.RawComponents[2][2]);
      t8 = ((((((this.RawComponents[1][0] * this.RawComponents[2][1]) * this.RawComponents[3][3]) - ((this.RawComponents[1][0] * this.RawComponents[2][3]) * this.RawComponents[3][1])) - ((this.RawComponents[2][0] * this.RawComponents[1][1]) * this.RawComponents[3][3])) + ((this.RawComponents[2][0] * this.RawComponents[1][3]) * this.RawComponents[3][1])) + ((this.RawComponents[3][0] * this.RawComponents[1][1]) * this.RawComponents[2][3])) - ((this.RawComponents[3][0] * this.RawComponents[1][3]) * this.RawComponents[2][1]);
      t12 = ((((-((this.RawComponents[1][0] * this.RawComponents[2][1]) * this.RawComponents[3][2]) + ((this.RawComponents[1][0] * this.RawComponents[2][2]) * this.RawComponents[3][1])) + ((this.RawComponents[2][0] * this.RawComponents[1][1]) * this.RawComponents[3][2])) - ((this.RawComponents[2][0] * this.RawComponents[1][2]) * this.RawComponents[3][1])) - ((this.RawComponents[3][0] * this.RawComponents[1][1]) * this.RawComponents[2][2])) + ((this.RawComponents[3][0] * this.RawComponents[1][2]) * this.RawComponents[2][1]);
      d = (((this.RawComponents[0][0] * t0) + (this.RawComponents[0][1] * t4)) + (this.RawComponents[0][2] * t8)) + (this.RawComponents[0][3] * t12);
      Result = $mod.TMat4.$create("Identity");
      if (d !== 0.0) {
        d = 1.0 / d;
        Result.RawComponents[0][0] = t0 * d;
        Result.RawComponents[0][1] = (((((-((this.RawComponents[0][1] * this.RawComponents[2][2]) * this.RawComponents[3][3]) + ((this.RawComponents[0][1] * this.RawComponents[2][3]) * this.RawComponents[3][2])) + ((this.RawComponents[2][1] * this.RawComponents[0][2]) * this.RawComponents[3][3])) - ((this.RawComponents[2][1] * this.RawComponents[0][3]) * this.RawComponents[3][2])) - ((this.RawComponents[3][1] * this.RawComponents[0][2]) * this.RawComponents[2][3])) + ((this.RawComponents[3][1] * this.RawComponents[0][3]) * this.RawComponents[2][2])) * d;
        Result.RawComponents[0][2] = (((((((this.RawComponents[0][1] * this.RawComponents[1][2]) * this.RawComponents[3][3]) - ((this.RawComponents[0][1] * this.RawComponents[1][3]) * this.RawComponents[3][2])) - ((this.RawComponents[1][1] * this.RawComponents[0][2]) * this.RawComponents[3][3])) + ((this.RawComponents[1][1] * this.RawComponents[0][3]) * this.RawComponents[3][2])) + ((this.RawComponents[3][1] * this.RawComponents[0][2]) * this.RawComponents[1][3])) - ((this.RawComponents[3][1] * this.RawComponents[0][3]) * this.RawComponents[1][2])) * d;
        Result.RawComponents[0][3] = (((((-((this.RawComponents[0][1] * this.RawComponents[1][2]) * this.RawComponents[2][3]) + ((this.RawComponents[0][1] * this.RawComponents[1][3]) * this.RawComponents[2][2])) + ((this.RawComponents[1][1] * this.RawComponents[0][2]) * this.RawComponents[2][3])) - ((this.RawComponents[1][1] * this.RawComponents[0][3]) * this.RawComponents[2][2])) - ((this.RawComponents[2][1] * this.RawComponents[0][2]) * this.RawComponents[1][3])) + ((this.RawComponents[2][1] * this.RawComponents[0][3]) * this.RawComponents[1][2])) * d;
        Result.RawComponents[1][0] = t4 * d;
        Result.RawComponents[1][1] = (((((((this.RawComponents[0][0] * this.RawComponents[2][2]) * this.RawComponents[3][3]) - ((this.RawComponents[0][0] * this.RawComponents[2][3]) * this.RawComponents[3][2])) - ((this.RawComponents[2][0] * this.RawComponents[0][2]) * this.RawComponents[3][3])) + ((this.RawComponents[2][0] * this.RawComponents[0][3]) * this.RawComponents[3][2])) + ((this.RawComponents[3][0] * this.RawComponents[0][2]) * this.RawComponents[2][3])) - ((this.RawComponents[3][0] * this.RawComponents[0][3]) * this.RawComponents[2][2])) * d;
        Result.RawComponents[1][2] = (((((-((this.RawComponents[0][0] * this.RawComponents[1][2]) * this.RawComponents[3][3]) + ((this.RawComponents[0][0] * this.RawComponents[1][3]) * this.RawComponents[3][2])) + ((this.RawComponents[1][0] * this.RawComponents[0][2]) * this.RawComponents[3][3])) - ((this.RawComponents[1][0] * this.RawComponents[0][3]) * this.RawComponents[3][2])) - ((this.RawComponents[3][0] * this.RawComponents[0][2]) * this.RawComponents[1][3])) + ((this.RawComponents[3][0] * this.RawComponents[0][3]) * this.RawComponents[1][2])) * d;
        Result.RawComponents[1][3] = (((((((this.RawComponents[0][0] * this.RawComponents[1][2]) * this.RawComponents[2][3]) - ((this.RawComponents[0][0] * this.RawComponents[1][3]) * this.RawComponents[2][2])) - ((this.RawComponents[1][0] * this.RawComponents[0][2]) * this.RawComponents[2][3])) + ((this.RawComponents[1][0] * this.RawComponents[0][3]) * this.RawComponents[2][2])) + ((this.RawComponents[2][0] * this.RawComponents[0][2]) * this.RawComponents[1][3])) - ((this.RawComponents[2][0] * this.RawComponents[0][3]) * this.RawComponents[1][2])) * d;
        Result.RawComponents[2][0] = t8 * d;
        Result.RawComponents[2][1] = (((((-((this.RawComponents[0][0] * this.RawComponents[2][1]) * this.RawComponents[3][3]) + ((this.RawComponents[0][0] * this.RawComponents[2][3]) * this.RawComponents[3][1])) + ((this.RawComponents[2][0] * this.RawComponents[0][1]) * this.RawComponents[3][3])) - ((this.RawComponents[2][0] * this.RawComponents[0][3]) * this.RawComponents[3][1])) - ((this.RawComponents[3][0] * this.RawComponents[0][1]) * this.RawComponents[2][3])) + ((this.RawComponents[3][0] * this.RawComponents[0][3]) * this.RawComponents[2][1])) * d;
        Result.RawComponents[2][2] = (((((((this.RawComponents[0][0] * this.RawComponents[1][1]) * this.RawComponents[3][3]) - ((this.RawComponents[0][0] * this.RawComponents[1][3]) * this.RawComponents[3][1])) - ((this.RawComponents[1][0] * this.RawComponents[0][1]) * this.RawComponents[3][3])) + ((this.RawComponents[1][0] * this.RawComponents[0][3]) * this.RawComponents[3][1])) + ((this.RawComponents[3][0] * this.RawComponents[0][1]) * this.RawComponents[1][3])) - ((this.RawComponents[3][0] * this.RawComponents[0][3]) * this.RawComponents[1][1])) * d;
        Result.RawComponents[2][3] = (((((-((this.RawComponents[0][0] * this.RawComponents[1][1]) * this.RawComponents[2][3]) + ((this.RawComponents[0][0] * this.RawComponents[1][3]) * this.RawComponents[2][1])) + ((this.RawComponents[1][0] * this.RawComponents[0][1]) * this.RawComponents[2][3])) - ((this.RawComponents[1][0] * this.RawComponents[0][3]) * this.RawComponents[2][1])) - ((this.RawComponents[2][0] * this.RawComponents[0][1]) * this.RawComponents[1][3])) + ((this.RawComponents[2][0] * this.RawComponents[0][3]) * this.RawComponents[1][1])) * d;
        Result.RawComponents[3][0] = t12 * d;
        Result.RawComponents[3][1] = (((((((this.RawComponents[0][0] * this.RawComponents[2][1]) * this.RawComponents[3][2]) - ((this.RawComponents[0][0] * this.RawComponents[2][2]) * this.RawComponents[3][1])) - ((this.RawComponents[2][0] * this.RawComponents[0][1]) * this.RawComponents[3][2])) + ((this.RawComponents[2][0] * this.RawComponents[0][2]) * this.RawComponents[3][1])) + ((this.RawComponents[3][0] * this.RawComponents[0][1]) * this.RawComponents[2][2])) - ((this.RawComponents[3][0] * this.RawComponents[0][2]) * this.RawComponents[2][1])) * d;
        Result.RawComponents[3][2] = (((((-((this.RawComponents[0][0] * this.RawComponents[1][1]) * this.RawComponents[3][2]) + ((this.RawComponents[0][0] * this.RawComponents[1][2]) * this.RawComponents[3][1])) + ((this.RawComponents[1][0] * this.RawComponents[0][1]) * this.RawComponents[3][2])) - ((this.RawComponents[1][0] * this.RawComponents[0][2]) * this.RawComponents[3][1])) - ((this.RawComponents[3][0] * this.RawComponents[0][1]) * this.RawComponents[1][2])) + ((this.RawComponents[3][0] * this.RawComponents[0][2]) * this.RawComponents[1][1])) * d;
        Result.RawComponents[3][3] = (((((((this.RawComponents[0][0] * this.RawComponents[1][1]) * this.RawComponents[2][2]) - ((this.RawComponents[0][0] * this.RawComponents[1][2]) * this.RawComponents[2][1])) - ((this.RawComponents[1][0] * this.RawComponents[0][1]) * this.RawComponents[2][2])) + ((this.RawComponents[1][0] * this.RawComponents[0][2]) * this.RawComponents[2][1])) + ((this.RawComponents[2][0] * this.RawComponents[0][1]) * this.RawComponents[1][2])) - ((this.RawComponents[2][0] * this.RawComponents[0][2]) * this.RawComponents[1][1])) * d;
      };
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
  $impl.PI = 3.14159265359;
  $impl.DEG2RAD = 3.14159265359 / 180.0;
  $impl.Matrix4x4Identity = null;
});
rtl.module("webgl",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("GLTypes",["System","webgl","JS","math"],function () {
  "use strict";
  var $mod = this;
  this.TVec2 = function (s) {
    if (s) {
      this.x = s.x;
      this.y = s.y;
    } else {
      this.x = 0.0;
      this.y = 0.0;
    };
    this.$equal = function (b) {
      return (this.x === b.x) && (this.y === b.y);
    };
  };
  this.TVec3 = function (s) {
    if (s) {
      this.x = s.x;
      this.y = s.y;
      this.z = s.z;
    } else {
      this.x = 0.0;
      this.y = 0.0;
      this.z = 0.0;
    };
    this.$equal = function (b) {
      return (this.x === b.x) && ((this.y === b.y) && (this.z === b.z));
    };
  };
  this.V3 = function (x, y, z) {
    var Result = new $mod.TVec3();
    Result.x = x;
    Result.y = y;
    Result.z = z;
    return Result;
  };
  this.ToFloats = function (v) {
    var Result = [];
    Result = rtl.arraySetLength(Result,0.0,3);
    Result[0] = v.x;
    Result[1] = v.y;
    Result[2] = v.z;
    return Result;
  };
  this.V2 = function (x, y) {
    var Result = new $mod.TVec2();
    Result.x = x;
    Result.y = y;
    return Result;
  };
});
rtl.module("GLUtils",["System","Mat4","GLTypes","browserconsole","Web","webgl","JS","Types","math","SysUtils"],function () {
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
      var list = [];
      list = value.CopyList();
      this.gl.uniformMatrix4fv(this.GetUniformLocation(name),false,list);
      $impl.GLFatal(this.gl,"gl.uniformMatrix4fv");
    };
    this.SetUniformVec3 = function (name, value) {
      this.gl.uniform3fv(this.GetUniformLocation(name),pas.GLTypes.ToFloats(new pas.GLTypes.TVec3(value)));
      $impl.GLFatal(this.gl,"gl.uniform3fv");
    };
    this.SetUniformFloat = function (name, value) {
      this.gl.uniform1f(this.GetUniformLocation(name),value);
      $impl.GLFatal(this.gl,"gl.uniform1f");
    };
    this.GetUniformLocation = function (name) {
      var Result = null;
      Result = this.gl.getUniformLocation(this.programID,name);
      $impl.GLFatal(this.gl,"gl.getUniformLocation");
      return Result;
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
  this.TModelData = function (s) {
    if (s) {
      this.verticies = s.verticies;
      this.indicies = s.indicies;
      this.floatsPerVertex = s.floatsPerVertex;
    } else {
      this.verticies = null;
      this.indicies = null;
      this.floatsPerVertex = 0;
    };
    this.$equal = function (b) {
      return (this.verticies === b.verticies) && ((this.indicies === b.indicies) && (this.floatsPerVertex === b.floatsPerVertex));
    };
  };
  this.kModelVertexFloats = (3 + 2) + 3;
  rtl.createClass($mod,"TModel",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.gl = null;
      this.data = new $mod.TModelData();
      this.vertexBuffer = null;
      this.indexBuffer = null;
    };
    this.$final = function () {
      this.gl = undefined;
      this.data = undefined;
      this.vertexBuffer = undefined;
      this.indexBuffer = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (context, modelData) {
      this.gl = context;
      this.data = new $mod.TModelData(modelData);
      this.Load();
    };
    this.Draw = function () {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.vertexBuffer);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer);
      this.EnableAttributes();
      this.gl.drawElements(this.gl.TRIANGLES,this.data.indicies.length,this.gl.UNSIGNED_SHORT,0);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,null);
    };
    this.EnableAttributes = function () {
      var offset = 0;
      var stride = 0;
      offset = 0;
      stride = this.data.floatsPerVertex * $mod.GLSizeof(WebGLRenderingContext.FLOAT);
      this.gl.enableVertexAttribArray(0);
      this.gl.vertexAttribPointer(0,3,this.gl.FLOAT,false,stride,offset);
      offset += $mod.GLSizeof(WebGLRenderingContext.FLOAT) * 3;
      this.gl.enableVertexAttribArray(1);
      this.gl.vertexAttribPointer(1,2,this.gl.FLOAT,false,stride,offset);
      offset += $mod.GLSizeof(WebGLRenderingContext.FLOAT) * 2;
      this.gl.enableVertexAttribArray(2);
      this.gl.vertexAttribPointer(2,3,this.gl.FLOAT,false,stride,offset);
      offset += $mod.GLSizeof(WebGLRenderingContext.FLOAT) * 3;
    };
    this.Load = function () {
      this.indexBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER,this.data.indicies,this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,null);
      this.vertexBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.vertexBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER,this.data.verticies,this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null);
    };
  });
  var kLineEnding = "\n";
  var kSpace = " ";
  this.LoadOBJFile = function (text) {
    var Result = new $mod.TModelData();
    var lines = [];
    var parts = [];
    var indices = null;
    var positions = null;
    var normals = null;
    var textures = null;
    var verticies = null;
    var mesh = null;
    var i = 0;
    var line = null;
    var vertex = new $impl.TOBJVertex();
    var vertexIndex = 0;
    var data = new $mod.TModelData();
    var pos = new pas.GLTypes.TVec3();
    var texCoord = new pas.GLTypes.TVec2();
    var normal = new pas.GLTypes.TVec3();
    positions = new Array();
    normals = new Array();
    textures = new Array();
    indices = new Array();
    verticies = new Array();
    lines = text.split(kLineEnding);
    for (var $l1 = 0, $end2 = rtl.length(lines) - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      line = lines[i];
      parts = line.split(kSpace);
      if (line.startsWith("v ")) {
        pos = new pas.GLTypes.TVec3(pas.GLTypes.V3(pas.SysUtils.StrToFloat(parts[1]),pas.SysUtils.StrToFloat(parts[2]),pas.SysUtils.StrToFloat(parts[3])));
        positions.push(new pas.GLTypes.TVec3(pos));
        vertex.position = new pas.GLTypes.TVec3(pos);
        vertex.textureIndex = -1;
        vertex.normalIndex = -1;
        verticies.push(new pas.GLTypes.TVec3(pos));
      } else if (line.startsWith("vn ")) {
        normals.push(new pas.GLTypes.TVec3(pas.GLTypes.V3(pas.SysUtils.StrToFloat(parts[1]),pas.SysUtils.StrToFloat(parts[2]),pas.SysUtils.StrToFloat(parts[3]))));
      } else if (line.startsWith("vt ")) {
        textures.push(new pas.GLTypes.TVec2(pas.GLTypes.V2(pas.SysUtils.StrToFloat(parts[1]),1 - pas.SysUtils.StrToFloat(parts[2]))));
      } else if (line.startsWith("f ")) {
        $impl.ProcessFace(verticies,indices,parts[1].split("\/"));
        $impl.ProcessFace(verticies,indices,parts[2].split("\/"));
        $impl.ProcessFace(verticies,indices,parts[3].split("\/"));
      };
    };
    data.floatsPerVertex = 8;
    mesh = new Float32Array(data.floatsPerVertex * verticies.length);
    for (var $l3 = 0, $end4 = verticies.length - 1; $l3 <= $end4; $l3++) {
      i = $l3;
      vertex = new $impl.TOBJVertex(rtl.getObject(verticies[i]));
      vertexIndex = i * data.floatsPerVertex;
      pos = new pas.GLTypes.TVec3(rtl.getObject(positions[i]));
      mesh[vertexIndex + 0] = pos.x;
      mesh[vertexIndex + 1] = pos.y;
      mesh[vertexIndex + 2] = pos.z;
      if (vertex.textureIndex !== -1) {
        texCoord = new pas.GLTypes.TVec2(rtl.getObject(textures[vertex.textureIndex]));
        mesh[vertexIndex + 3] = texCoord.x;
        mesh[vertexIndex + 4] = texCoord.y;
      } else {
        mesh[vertexIndex + 3] = 0;
        mesh[vertexIndex + 4] = 0;
      };
      if (vertex.normalIndex !== -1) {
        normal = new pas.GLTypes.TVec3(rtl.getObject(normals[vertex.normalIndex]));
        mesh[vertexIndex + 5] = normal.x;
        mesh[vertexIndex + 6] = normal.y;
        mesh[vertexIndex + 7] = normal.z;
      };
    };
    data.verticies = mesh;
    data.indicies = new Uint16Array(indices);
    Result = new $mod.TModelData(data);
    return Result;
  };
  this.GLSizeof = function (glType) {
    var Result = 0;
    var $tmp1 = glType;
    if (($tmp1 === WebGLRenderingContext.UNSIGNED_BYTE) || ($tmp1 === WebGLRenderingContext.BYTE)) {
      Result = 1}
     else if (($tmp1 === WebGLRenderingContext.SHORT) || ($tmp1 === WebGLRenderingContext.UNSIGNED_SHORT)) {
      Result = 2}
     else if (($tmp1 === WebGLRenderingContext.INT) || ($tmp1 === WebGLRenderingContext.UNSIGNED_INT)) {
      Result = 4}
     else if ($tmp1 === WebGLRenderingContext.FLOAT) {
      Result = 4}
     else {
      $impl.Fatal("GLSizeof type is invalid.");
    };
    return Result;
  };
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
    if (error !== WebGLRenderingContext.NO_ERROR) {
      var $tmp1 = error;
      if ($tmp1 === WebGLRenderingContext.INVALID_VALUE) {
        messageString = messageString + " (GL_INVALID_VALUE)"}
       else if ($tmp1 === WebGLRenderingContext.INVALID_OPERATION) {
        messageString = messageString + " (GL_INVALID_OPERATION)"}
       else if ($tmp1 === WebGLRenderingContext.INVALID_ENUM) {
        messageString = messageString + " (GL_INVALID_ENUM)"}
       else {
        messageString = (messageString + " ") + pas.SysUtils.IntToStr(error);
      };
      $impl.Fatal(messageString);
    };
  };
  $impl.TOBJVertex = function (s) {
    if (s) {
      this.position = new pas.GLTypes.TVec3(s.position);
      this.textureIndex = s.textureIndex;
      this.normalIndex = s.normalIndex;
    } else {
      this.position = new pas.GLTypes.TVec3();
      this.textureIndex = 0;
      this.normalIndex = 0;
    };
    this.$equal = function (b) {
      return this.position.$equal(b.position) && ((this.textureIndex === b.textureIndex) && (this.normalIndex === b.normalIndex));
    };
  };
  $impl.ProcessFace = function (verticies, indices, face) {
    var Result = new $impl.TOBJVertex();
    var index = 0;
    var vertex = new $impl.TOBJVertex();
    index = pas.SysUtils.StrToInt(face[0]) - 1;
    vertex = new $impl.TOBJVertex(rtl.getObject(verticies[index]));
    if (index > 65536) $impl.Fatal("overflowed indices array");
    if (face[1] !== "") {
      vertex.textureIndex = pas.SysUtils.StrToInt(face[1]) - 1}
     else vertex.textureIndex = -1;
    if (face[2] !== "") {
      vertex.normalIndex = pas.SysUtils.StrToInt(face[2]) - 1}
     else vertex.normalIndex = -1;
    indices.push(index);
    verticies[index] = new $impl.TOBJVertex(vertex);
    Result = new $impl.TOBJVertex(vertex);
    return Result;
  };
});
rtl.module("program",["System","Types","Mat4","GLUtils","GLTypes","SysUtils","browserconsole","Web","webgl","JS","math"],function () {
  "use strict";
  var $mod = this;
  this.gl = null;
  this.shader = null;
  this.projTransform = null;
  this.viewTransform = null;
  this.modelTransform = null;
  this.dragonModel = null;
  this.rotateAngle = 0;
  this.deltaTime = 0;
  this.nextTime = 0;
  this.DrawCanvas = function () {
    $mod.gl.clear($mod.gl.COLOR_BUFFER_BIT + $mod.gl.DEPTH_BUFFER_BIT);
    if ($mod.dragonModel !== null) {
      $mod.modelTransform = pas.Mat4.TMat4.$create("Identity");
      $mod.modelTransform = $mod.modelTransform.Multiply(pas.Mat4.TMat4.$create("RotateY",[pas.math.DegToRad($mod.rotateAngle)]));
      $mod.shader.SetUniformMat4("modelTransform",$mod.modelTransform);
      $mod.dragonModel.Draw();
    };
  };
  this.AnimateCanvas = function (time) {
    var now = 0.0;
    now = time * 0.001;
    $mod.deltaTime = now - $mod.nextTime;
    $mod.nextTime = now;
    $mod.rotateAngle = $mod.rotateAngle + (20 * $mod.deltaTime);
    $mod.DrawCanvas();
    window.requestAnimationFrame($mod.AnimateCanvas);
  };
  this.StartAnimatingCanvas = function () {
    window.requestAnimationFrame($mod.AnimateCanvas);
  };
  rtl.createClass($mod,"TModelLoader",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.gl$1 = null;
      this.request = null;
    };
    this.$final = function () {
      this.gl$1 = undefined;
      this.request = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (context, path) {
      this.gl$1 = context;
      this.request = new XMLHttpRequest();
      this.request.open("GET",path);
      this.request.overrideMimeType("application\/text");
      this.request.onreadystatechange = rtl.createCallback(this,"HandleLoaded");
      this.request.send();
    };
    this.HandleLoaded = function () {
      var data = new pas.GLUtils.TModelData();
      if (((this.request.readyState === 4) && (this.request.status === 200)) && (this.request.responseText.length > 0)) {
        data = new pas.GLUtils.TModelData(pas.GLUtils.LoadOBJFile(this.request.responseText));
        $mod.dragonModel = pas.GLUtils.TModel.$create("Create$1",[this.gl$1,new pas.GLUtils.TModelData(data)]);
        $mod.StartAnimatingCanvas();
      };
    };
  });
  this.canvas = null;
  this.vertexShaderSource = "";
  this.fragmentShaderSource = "";
  $mod.$main = function () {
    $mod.canvas = document.createElement("canvas");
    $mod.canvas.width = 600;
    $mod.canvas.height = 600;
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
    $mod.shader.BindAttribLocation(1,"in_texCoord");
    $mod.shader.BindAttribLocation(2,"in_normal");
    $mod.shader.Link();
    $mod.shader.Use();
    $mod.gl.clearColor(0.9,0.9,0.9,1);
    $mod.gl.viewport(0,0,$mod.canvas.width,$mod.canvas.height);
    $mod.gl.clear($mod.gl.COLOR_BUFFER_BIT);
    $mod.gl.enable($mod.gl.DEPTH_TEST);
    $mod.gl.enable($mod.gl.BLEND);
    $mod.gl.enable($mod.gl.CULL_FACE);
    $mod.gl.cullFace($mod.gl.BACK);
    $mod.projTransform = pas.Mat4.TMat4.$create("Perspective",[60.0,$mod.canvas.width / $mod.canvas.height,0.1,2000]);
    $mod.shader.SetUniformMat4("projTransform",$mod.projTransform);
    $mod.viewTransform = pas.Mat4.TMat4.$create("Identity");
    $mod.viewTransform = $mod.viewTransform.Multiply(pas.Mat4.TMat4.$create("Translate",[0,-3,-20]));
    $mod.shader.SetUniformMat4("viewTransform",$mod.viewTransform);
    $mod.shader.SetUniformMat4("inverseViewTransform",$mod.viewTransform.Inverse());
    $mod.shader.SetUniformVec3("lightPosition",new pas.GLTypes.TVec3(pas.GLTypes.V3(0,0,25)));
    $mod.shader.SetUniformVec3("lightColor",new pas.GLTypes.TVec3(pas.GLTypes.V3(1,1,1)));
    $mod.shader.SetUniformFloat("shineDamper",10);
    $mod.shader.SetUniformFloat("reflectivity",1);
    $mod.TModelLoader.$create("Create$1",[$mod.gl,"res\/dragon.obj"]);
  };
});
