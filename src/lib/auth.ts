import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "text", placeholder: "your-email@example.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, req) {
                if (!credentials?.email || !credentials?.password) return null;
            
                // Check User 1 (Admin)
                if (credentials.email === process.env.ADMIN_EMAIL && 
                    credentials.password === process.env.ADMIN_PASSWORD) {
                    return { id: "1", name: "Michael", email: credentials.email };
                }
            
                // Check User 2 (Guest)
                if (credentials.email === process.env.GUEST_EMAIL && 
                    credentials.password === process.env.GUEST_PASSWORD) {
                    return { id: "2", name: "Guest", email: credentials.email };
                }
            
                // If neither matches, reject login
                return null;
            }
        })
    ],
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
    },
}