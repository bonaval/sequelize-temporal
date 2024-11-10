declare module 'sequelize-temporal' {
	interface Options {
		blocking?:boolean,
		full?:boolean,
		skipIfSilent?:boolean,
		reloadIgnoredAttributes?:string[]
	}

	function output<T>(define:T, sequelize:any, options?:Options): T

	export = output;
}
