declare module 'sequelize-record' { 
	interface Options { 
		blocking?:boolean,
		full?:boolean,
		modelSuffix?:string,
		addAssociations?:boolean,
	}

	function output<T>(define:T, sequelize:any, options?:Options): T

	export = output;
}
