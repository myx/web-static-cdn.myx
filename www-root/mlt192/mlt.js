function log(){
	const x = Array.from(arguments);
	x[0] = "MLT: " + x[0];
	console.log.apply(console, x);
}
function err(){
	const x = Array.from(arguments);
	x[0] = "MLT: " + x[0];
	console.error.apply(console, x);
}

const debug = true;

log("initializing...");



export const Templates = new (class Templates{
	constructor(){
	}
	async init(name, href){
		let root = document.body.querySelector(name);
		if(root){
			log("templates: using embedded element: " + name);
			this.root = root;
			return;
		}
		
		root = document.createElement(name);
		root.style.cssText = "display: block; position: absolute; bottom: -1px; left: -1px; width: 0; height: 0; overflow: hidden;";
		document.body.append(root);
		this.root = root;
		// start download
		let reply = await fetch(href, {
			mode: "cors",
			credentials: "omit"
		});
		let text = await reply.text();
		return this.apply(name, text);
	}
	apply(name, text){
		log("templates: loaded: " + text.length + " characters");
		let sandbox = document.createElement("div");
		sandbox.innerHTML = text;
		let templates = sandbox.querySelector(name);
		if(!templates){
			throw new Error("No templates (by element '" + name + "')!");
		}
		if(templates){
			for(let x of Array.from(templates.children || [])){
				this.root.appendChild(x);
				log("templates: applied: " + x.getAttribute("id"));
			}
			log("templates: applied");
		}
		return;
	}
	get(name){
		const t = this.root.querySelector("#-mpa-" + name);
		if(!t){
			throw new Error("No template: " + name + " (id=#-mpa-" + name + ")");
		}
		const template = (
			t.content
				? document.importNode(t.content, true)
				: t.cloneNode(true)
		).firstElementChild;
		return template;
	}
})();





export class ScreenAbstract {
	constructor(){
		this.status = "initial";
	}
	
	create(){
		debug && log(this + ": create");
		switch(this.status){
		case "initial":{
			this.status = "ready";
			this.onCreate();
			return;
		}
		case "ready":
		case "active":{
			return;
		}
		default:{
			log(this + ": create failure, invalid state: " + this.status);
			throw new Error("Unexpected state: " + this.status);
		}
		}
	}
	
	insert(){
		debug && log(this + ": insert default");
		ui.element.appendChild(this.screen);
	}
	remove(){
		debug && log(this + ": remove default");
	}
	
	enter(){
		debug && log(this + ": enter");
		switch(this.status){
		case "initial":{
			this.status = "ready";
			this.onCreate();
			// fall-through (no `break`)
		}
		case "ready":{
			while(ui.view && ui.view.priority <= this.priority){
				if(ui.view === this){
					debug && log(this + ": enter, entering, has needed view");
					// this.insert();
					this.status = "active";
					this.onEnter();
					ui.checkContext();
					return;
				}
				debug && log(this + ": enter, entering, destroy view " + ui.view + ", priority: " + ui.view.priority + " vs " + this.priority);
				ui.view.destroy();
				ui.view = ui.view.parent || null;
			}
			this.parent || (this.parent = ui.view);
			this.insert();
			if(this.isView !== false){
				ui.view && ui.view.leave();
				ui.view = this;
			}
			this.status = "active";
			this.onEnter();
			ui.checkContext();
			return;
		}
		case "active":{
			return;
		}
		default:{
			log(this + ": enter failure, invalid state: " + this.status);
			throw new Error("Unexpected state: " + this.status);
		}
		}
	}
	
	leave(){
		debug && log(this + ": leave");
		switch(this.status){
		case "initial":{
			return;
		}
		case "active":{
			this.status = "ready";
			this.onLeave();
			return;
		}
		case "ready":{
			return;
		}
		default:{
			log(this + ": leave failure, invalid state: " + this.status);
			throw new Error("Unexpected state: " + this.status);
		}
		}
	}
	
	destroy(){
		debug && log(this + ": destroy");
		switch(this.status){
		case "initial":{
			return;
		}
		case "active":{
			this.status = "ready";
			this.onLeave();
			this.status = "initial";
			this.onDestroy();
			return;
		}
		case "ready":{
			this.status = "initial";
			this.onDestroy();
			return;
		}
		default:{
			log(this + ": destroy failure, invalid state: " + this.status);
			throw new Error("Unexpected state: " + this.status);
		}
		}
	}
	
	onCreate(){
		debug && log(this + ": onCreate: " + this.screenReady);
		if(this.screen){
			const ve = this.viewElements;
			for(let b of this.screen.querySelectorAll("view-commands > button, header-side > button, view-text > span[name]")){
				b.mltName = (b.mltName || b.getAttribute("name") || b.classList[0]);
				if(ve && !ve[b.mltName]){
					b.classList.add("ui-hide");
				}
			}
		}
	}
	
	onEnter(){
		debug && log(this + ": onEnter: " + this.screenReady);
	}
	
	onEvent(command){
		debug && log(this + ": onEvent: " + command);
		return undefined;
	}
	
	onLeave(){
		debug && log(this + ": onLeave: " + this.screenReady);
	}
	
	onDestroy(){
		debug && log(this + ": onDestroy");
		this.screen.classList.add('ui-disappear');
		
		setTimeout( (this.screen.ontransitionend = rm.bind(null, this.screen)) , 750);
	}
	
	/**
	 * screens with greater 'priority' replace (destroy and remove) screens with smaller 'priority'
	 * 1000-2000 - modals
	 * 3000-4000 - root screens
	 */
	get priority(){
		return 0;
	}
	/**
	 * when specified, only those buttons and major elements will be left: TODO: replace with css display:none 
	 */
	get viewElements(){
		return null;
	}
	get name(){
		return "screen-abstract";
	}
	
	toString(){
		return "ScreenAbstract(" + this.name + ", " + this.status + ")";
	}
}



export class ScreenFocuser extends ScreenAbstract {
	constructor(){
		super();
		this.screen = Templates.get("focus-plane");
		this.focused = null;
	}
	insert(){
		this.parent.screen.appendChild(this.screen);
	}
	onCreate(){
		super.onCreate();
		const s = this.screen;
		
		s.classList.add("ui-appear");
		setTimeout( (s.onanimationend = function(){
			s.classList.remove("ui-appear");
		}), 750);
		
		for(let x of ["touchstart","touchmove","mousedown","touchend","touchcancel","click"]){
			s.addEventListener(x, this.onTouchHandler.bind(this), true);
		}
	}
	
	onEnter(){
		this.checkFocused();
		super.onEnter();
	}
	onDestroy(){
		super.onDestroy();
		if(this.focused === this.parent.focusedElement){
			this.parent.focusElement();
			ui.checkContext();
		}
		this.focused && this.focused.classList.remove("ui-focused", "-lt-focused");
	}
	
	onTouchHandler(e){
		this.parent.focusElement();
		ui.checkContext();
		return true;
	}
	
	checkFocused(){
		const	e = this.parent.focusedElement,
				f = this.focused,
				s = this.screen;
		if(e === f){
			return;
		}
		if(f){
			f.classList.remove("ui-focused", "-lt-focused");
		}
		if(e){
			e.classList.add("ui-focused", "-lt-focused");
			this.focused = e;
			// e.scrollIntoView();
		}else{
			this.focused = null;
		}
	}
	get isView(){
		return false;
	}
	get priority(){
		return 3000;
	}
	toString(){
		return "ScreenFocuser";
	}
}




export class ScreenBlocker extends ScreenAbstract {
	constructor(){
		super();
		this.screen = Templates.get("modal-plane");
		this.focused = null;
	}
	onCreate(){
		super.onCreate();
		this.checkFocused();
		
		const s = this.screen;
		
		s.classList.add("ui-appear");
		setTimeout( (s.onanimationend = function(){
			s.classList.remove("ui-appear");
		}), 750);
	}
	
	onEnter(){
		this.checkFocused();
		super.onEnter();
	}
	onDestroy(){
		super.onDestroy();
		this.focused && this.focused.classList.remove("ui-exclusive");
	}

	checkFocused(){
		const	e = ui.focusedElement,
				f = this.focused,
				s = this.screen;
		if(e === f){
			debug && log("ScreenBlocker: check focused, no change");
			return;
		}
		if(f){
			f.classList.remove("ui-exclusive");
		}
		if(e){
			e.classList.add("ui-exclusive");
			f || s.classList.add("ui-blocker-focused", "ui-blocker-exclusive");
			this.focused = e;
		}else{
			f && s.classList.remove("ui-blocker-focused", "ui-blocker-exclusive");
			this.focused = null;
		}
		debug && log("ScreenBlocker: check focused, focused: " + this.focused);
	}
	get priority(){
		return 2000;
	}
	get isBlocker(){
		return true;
	}
	toString(){
		return "ScreenBlocker";
	}
}




export class ScreenModal extends ScreenAbstract {
	constructor(){
		super();
		this.parentScreen = ui.screen;
	}
	
	/**
	 * ensuring/adding a blocker ui 
	 */
	insert(){
		const p = this.parent;
		if(p && p.isBlocker){
			log("ScreenModal: reusing blocker");
			this.blocker = p;
			p.checkFocused();
		}else{
			log("ScreenModal: creating new blocker");
			const b = new ScreenBlocker();
			this.blocker = b;
			this.blocker.parent = p;
			this.parent = b;
			b.enter();
		}
		super.insert();
	}
	onCreate(){
		super.onCreate();
		this.head = this.screen.querySelector("modal-head");
		this.body = this.screen.querySelector("modal-body");
		
		for(let x of [this.screen, this.head]){
			x && (x.classList.add(this.name));
		}

		this.screen.classList.add('ui-appear');
		setTimeout(this.screen.onanimationend = (()=>{
			this.screen.classList.remove("ui-appear");
		}), 750);
	}
	onEnter(){
		super.onEnter();
		let f = this.body && this.body.querySelector("a.-lt-modal-anchor");
		f && f.focus();
		debug && log("ScreenModal: focus: " + f);
	}
	onEvent(command){
		return super.onEvent(command);
	}
	onDestroy(){
		super.onDestroy();
	}
	

	get priority(){
		return 1000;
	}
	get isModal(){
		return true;
	}
	get name(){
		return "screen-modal";
	}
}




export class ScreenFullView extends ScreenAbstract {
	constructor(){
		super();
	}
	onCreate(){
		super.onCreate();
		document.body.classList.add("screen-" + this.name);
	}
	onEnter(){
		super.onEnter();
		ui.screen = this;
		if(this.screen){
			this.screen.classList.contains("-lt-screen-events") || this.screen.classList.add("-lt-screen-events");
			this.screen.focus && this.screen.focus();
		}
	}
	onDestroy(){
		super.onDestroy();
		document.body.classList.remove("screen-" + this.name);
		ui.screen === this && (ui.screen = this.parent);
	}
	

	get priority(){
		return 3100;
	}
	get name(){
		throw new Error("'name' getter must be overriden!");
	}
}




export class ScreenInitial extends ScreenFullView {
	constructor(screenElement){
		super();
		if(!screenElement){
			throw new Error("screenElement is required!");
		}
		this.screen = screenElement;
		this.status = "ready";
	}
	enter(){
		ui.view = this;
		this.screen.classList.remove("ui-inactive");
	}
	leave(){
		setTimeout(function(){
			this.screen.classList.add("ui-inactive");
		}.bind(this), 450);
	}
	

	get priority(){
		return 9999;
	}
	get name(){
		return "initial";
	}
}




export class Plane {
	constructor(element){
		let e = this.element = element;
		this.body = document.body;
		this.view = null;
		this.screen = null;

		if(!element.mltInitial){
			element.mltInitial = this.element.innerHTML;
		}else{
			this.element.innerHTML = element.mltInitial;
		}
		
		this.view = new ScreenInitial(this.element.firstElementChild);
		
		debug && this.view.screen.setAttribute("mlt-screen-initial","" + Date.now());
		
		this.context = Templates.get("pinned-context-menu");
		this.contextBody = this.context.querySelector("context-body");
		this.element.appendChild(this.context);

		e.onmouseup = e.onmousedown = e.onmousemove = e.onmouseover =
		e.onclick = e.onscroll = e.onwheel = 
		e.ontouchstart = e.ontouchmove = e.ontouchend = e.ontouchcancel = undefined;

		let x;
		for(x of ["mouseup","mousemove","mouseover","mouseout"]){
			e.addEventListener(x, this.onPreventHandler.bind(this), true);
		}
		for(x of ["touchstart","mousedown","touchend","touchcancel"]){
			e.addEventListener(x, this.onTouchHandler.bind(this), true);
		}
		for(x of ["touchmove","wheel","scroll"]){
			e.addEventListener(x, this.onScrollHandler.bind(this), true);
		}
		for(x of ["click"]){
			e.addEventListener(x, this.onClickHandler.bind(this), true);
		}

		e.addEventListener("keydown", this.onKeyDownHandler.bind(this), true);

		this.onBeforeLogin = null;
		this.onAfterLogin = null;
	}	
	onPreventHandler(e){
		e.stopPropagation();
		e.stopImmediatePropagation()
		e.preventDefault();
		return false;
	}
	onKeyDownHandler(e){
		if (e.defaultPrevented) {
			return;
		}

		switch (e.key) {
		case "Enter":
			for(let n = e.target; n && n !== e.currentTarget; n = n.parentElement){
				let action;
				action = n.mltEnter || n.getAttribute("-mlt-enter");
				if(action){
					log("enter: ("+this+") event handler: " + action + ", target: " + n.tagName);
					e.preventDefault();
					e.stopPropagation();
					("function" === typeof action ? action : ae(action)).call(n);
					return false;
				}
				action = n.mltEnterClick || n.getAttribute("mlt-enter-click");
				action && (action = n.parentElement.querySelector(action));
				if(action){
					n.blur && n.blur();
					action.focus && action.focus();
					e.clickTarget = action;
					return this.onClickHandler(e);
				}

				if(n.classList.contains("-ui-scrollable") || n.mltClick || n.getAttribute("mlt-click")){
					e.stopPropagation();
					return true;
				}
				switch(n.tagName){
				case "BUTTON":
				case "LABEL":
				case "INPUT":
					e.stopPropagation();
					return true;
				}
				if(n.classList.contains("-lt-screen-events")){
					e.stopPropagation();
					return true;
				}
			}
			e.preventDefault();
			e.stopPropagation();
			return false;
		case "Esc": // IE/Edge specific value
		case "Escape":
			setTimeout(ae("click-button-close"), 0);
			e.preventDefault();
			e.stopPropagation();
			return false;
	  }
	}
	onTouchHandler(e){
		// log("touch: ("+this+") event");
		for(let n = e.target; n && n !== e.currentTarget; n = n.parentElement){
			if(n.classList.contains("-ui-scrollable") || n.mltClick || n.getAttribute("mlt-click")){
				// log("touch: ("+this+") event, found scrollable");
				e.stopPropagation();
				return true;
			}
			switch(n.tagName){
			case "BUTTON":
			case "LABEL":
			case "INPUT":
				// log("touch: ("+this+") event, found clickable");
				e.stopPropagation();
				return true;
			}
			if(n.classList.contains("-lt-screen-events")){
				// log("touch: ("+this+") event, prevented");
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
			// log("touch: ("+this+") event: " + n.tagName);
		}
		// log("touch: ("+this+") event, prevented, default");
		e.preventDefault();
		e.stopPropagation();
		return false;
	}
	onScrollHandler(e){
		// log("scroll: ("+this+") event");
		for(let n = e.target; n && n !== e.currentTarget; n = n.parentElement){
			if(n.classList.contains("-ui-scrollable")){
				// log("scroll: ("+this+") event, found scrollable");
				e.stopPropagation();
				return true;
			}
			if(n.classList.contains("-lt-screen-events")){
				// log("scroll: ("+this+") event, prevented");
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
			// log("scroll: ("+this+") event: " + n.tagName);
		}
		// log("scroll: ("+this+") event, prevented, default");
		e.preventDefault();
		e.stopPropagation();
		return false;
	}
	onClickHandler(e){
		debug && log("click: ("+this+") event");
		search: for(let n = e.clickTarget || e.target; n && n !== e.currentTarget; n = n.parentElement){
			let action = n.mltClick || n.getAttribute("mlt-click");
			if(!action && n.hasAttribute("mlt-click")){
				let name = n.mltName || n.getAttribute("name") || n.classList[0];
				name && (action = "click-" + name);
			}
			if(action){
				debug && log("click: ("+this+") event handler: " + action + ", target: " + n.tagName);
				if(n.classList.contains("-lt-click-focus")){
					for(let f = n; f && f !== e.currentTarget; f = f.parentElement){
						if(f.classList.contains("-lt-click-focus-element")){
							debug && log("click: ("+this+") event handler: " + action + ", target: " + n.tagName + ", focus: " + f.tagName);
							if(this.focusedElement === f){
								if(this.screen !== this.view){
									continue search;
								}
								this.focusElement();
								e.preventDefault();
								e.stopPropagation();
								return false;
							}
							this.focusElement(f);
							break;
						}
						if(f.classList.contains("-lt-screen-events")){
							break;
						}
					}
				}else{
					if(this.screen === this.view){
						debug && log("click: ("+this+") focus clear");
						const f = this.focusedElement;
						setTimeout(()=>{
							this.focusedElement === f && this.focusElement();
						},0);
					}
				}
				("function" === typeof action ? action : ae(action)).call(n);
				switch(n.tagName){
				case "LABEL":
					e.stopPropagation();
					return true;
				}
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
			if(n.classList.contains("-lt-screen-events")){
				debug && log("click: ("+this+") event, prevented");
				this.focusElement();
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
			switch(n.tagName){
			case "BUTTON":
			case "LABEL":
			case "INPUT":
				debug && log("click: ("+this+") event, found clickable");
				e.stopPropagation();
				return true;
			}
			debug && log("click: ("+this+") event: " + n.tagName);
		}
		debug && log("click: ("+this+") event, continue");
		return true;
	}
	get focusedElement(){
		return this.screen && this.screen.focusedElement || null;
	}
	focusElement(e){
		this.screen && this.screen.focusElement && this.screen.focusElement(e);
	}
	contextClass(name, active){
		for(let t of [this.context, this.contextBody]){
			t.classList[active ? "add" : "remove"](name);
		}
		return active;
	}
	contextShown(){
		const x = (getComputedStyle(this.element).getPropertyValue('--lt-right-context-sz') || "0").trim();
		debug && log("context shown: " + x + ", " + (typeof x));
		return x && x !== "0" ? x : false;
	}
	checkContext(force){
		force || (force = this.focusedElement && !this.focusedElement.classList.contains("-lt-element-focused") );
		this.contextClass("-lt-element-focused", this.focusedElement);
		force && setTimeout(()=>{
			this.contextBody.scrollTop = 0;
		},0);
	}
	checkLooks(){
		//
	}
}

export function hello(){
	return "hello!";
}

log("initialized.");
