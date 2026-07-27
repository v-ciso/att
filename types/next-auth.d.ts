import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      marketOwnerId?: string;
      employeeId?: string;
      isSuperAdmin?: boolean;
      companyName?: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: string;
    marketOwnerId?: string;
    employeeId?: string;
    companyName?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    marketOwnerId?: string;
    employeeId?: string;
    isSuperAdmin?: boolean;
    companyName?: string;
  }
}
