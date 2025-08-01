import { HTTPContext } from "./httpcontext";

export type ErrorHandler = (error: any, c : HTTPContext<any>) => void | Promise<void>;