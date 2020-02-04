(self.MLT = self.MLT || (function(){
	function log(){
		const x = Array.from(arguments);
		x[0] = "MLT: " + x[0];
		console.log.apply(console, x);
	}
	
	log("MLT, init...");
	
	return {
		Templates : new (class Templates {
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
				return fetch(href, {
					mode: "cors",
					credentials: "omit"
				}).then((text) => {
					return this.apply(name, text);
				});
			}
			async apply(name, text){
				log("templates: loaded: " + text.length + " characters");
				let sandbox = document.createElement("div");
				sandbox.innerHTML = text;
				let templates = sandbox.querySelector(name);
				if(!templates){
					throw new Error("No templates (by element '" + name + "')!");
				}
				for(let x of Array.from(templates.children || [])){
					this.root.appendChild(x);
					log("templates: applied: " + x.getAttribute("id"));
				}
				log("templates: applied");
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
		})()
	};
})())

