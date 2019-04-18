declare module 'sequelize-temporal' { 
	enum relations {
		DISABLED,
		ORIGIN,
		HISTORY
	}
	
	interface Options { 
		blocking?:boolean,
		full?:boolean,
		modelSuffix?:string,
		keepRelations?:relations,
	}

	function output<T>(define:T, sequelize:any, options?:Options): T

	export = output;
}
