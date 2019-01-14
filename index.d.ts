declare module 'sequelize-temporal' { 
	interface Options { 
		blocking?:boolean,
		full?:boolean
	}

	function output<T>(define:T, sequelize:any, options?:Options): T

	export = output;
}
