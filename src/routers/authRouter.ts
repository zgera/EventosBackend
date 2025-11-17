import { Router, Request, Response } from "express";
import { AuthenticationService } from "../services/authenticationService";
import { JWTService } from "../services/JWTService";
import { CreateUserBody } from "../types/user";
import { TokenData } from "../types/auth";

const authenticationService = new AuthenticationService()
export const authRouter = Router();
/**
 * Registro de nuevo usuario
 */
authRouter.post("/signup", async (req: Request, res: Response) => {
    const { firstName, lastName, username, document, email, password } = req.body;

    const userBody: CreateUserBody = { firstName, lastName, username, document, email, password };

    try {
        const user = await authenticationService.signUp(userBody);

        const tokenData: TokenData = {
            userId: user.idUser,
            username: user.username,
        };

        const token = JWTService.createToken(tokenData);

        res
            .cookie("access_token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 1000 * 60 * 60, // 1 hora
            })
            .status(201)
            .send({ user }); 

    } catch (error) {
        const message = error instanceof Error ? error.message : "Error inesperado al registrarse";
        res.status(401).send({ error: message });
    }
});

/**
 * Inicio de sesión
 */
authRouter.post("/signin", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
        const user = await authenticationService.signIn(username, password);

        const tokenData: TokenData = {
            userId: user.idUser,
            username: user.username,
        };

        const token = JWTService.createToken(tokenData);

        res
            .cookie("access_token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 1000 * 60 * 60, // 1 hora
            })
            .status(200)
            .send({ user });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error inesperado al iniciar sesión";
        res.status(401).send({ error: message });
    }
});

authRouter.post("/signout", (req: Request, res: Response) => {
    res
        .clearCookie("access_token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        })
        .status(200)
        .send({ message: "Cierre de sesión exitoso" });
});
