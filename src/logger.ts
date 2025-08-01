

export interface Logger{
	log(data? : any) : void | Promise<void>;
}