import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "text", placeholder: "user@example.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, req) {
                // Simple mock logic for demonstration/migration purpose
                // Accept any email, password is effectively ignored/optional for migration ease
                // In production, validate password here.
                if (credentials?.email) {
                    return { id: "1", name: "User", email: credentials.email }
                }
                return null
            }
        })
    ],
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
    },
}
