import Stripe from "stripe";
import { envVeriables } from "./envConfig";


export const stripe = new Stripe(envVeriables.STRIPE_SECRET_KEY);