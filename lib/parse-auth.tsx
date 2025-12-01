'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Parse, getCurrentUser, handleParseError, UserProfile, parseObjectToJSON } from './parse';

type AuthContextType = {
    user: Parse.User | null;
    profile: UserProfile | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    signUp: (email: string, password: string, fullName: string, additionalData?: any) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<Parse.User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback((parseUser: Parse.User): UserProfile => {
        return {
            id: parseUser.id,
            email: parseUser.get('email') || parseUser.get('username'),
            full_name: parseUser.get('full_name') || parseUser.get('fullName') || '',
            role: parseUser.get('role') || 'user',
            avatar_url: parseUser.get('avatar_url') || parseUser.get('avatarUrl') || null,
            is_verified: parseUser.get('is_verified') ?? parseUser.get('isVerified') ?? false,
            is_active: parseUser.get('is_active') ?? parseUser.get('isActive') ?? true,
            fonction: parseUser.get('fonction'),
            service: parseUser.get('service'),
            telephone: parseUser.get('telephone'),
            createdAt: parseUser.createdAt || new Date(),
            updatedAt: parseUser.updatedAt || new Date(),
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const initAuth = async () => {
            try {
                const currentUser = getCurrentUser();

                if (isMounted) {
                    if (currentUser) {
                        // Refresh user data from server
                        await currentUser.fetch();
                        setUser(currentUser);
                        setProfile(fetchProfile(currentUser));
                    } else {
                        setUser(null);
                        setProfile(null);
                    }
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
                if (isMounted) {
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                }
            }
        };

        initAuth();

        return () => {
            isMounted = false;
        };
    }, [fetchProfile]);

    const signIn = async (email: string, password: string) => {
        try {
            const parseUser = await Parse.User.logIn(email.toLowerCase(), password);

            // Fetch fresh user data
            await parseUser.fetch();

            setUser(parseUser);
            setProfile(fetchProfile(parseUser));
        } catch (error) {
            throw new Error(handleParseError(error));
        }
    };

    const signOut = async () => {
        try {
            await Parse.User.logOut();
            setUser(null);
            setProfile(null);
        } catch (error) {
            throw new Error(handleParseError(error));
        }
    };

    const signUp = async (
        email: string,
        password: string,
        fullName: string,
        additionalData?: any
    ) => {
        try {
            const parseUser = new Parse.User();
            parseUser.set('username', email.toLowerCase());
            parseUser.set('email', email.toLowerCase());
            parseUser.set('password', password);
            parseUser.set('full_name', fullName);
            parseUser.set('fullName', fullName);
            parseUser.set('role', 'user');
            parseUser.set('is_verified', false);
            parseUser.set('isVerified', false);
            parseUser.set('is_active', true);
            parseUser.set('isActive', true);

            // Add additional data if provided
            if (additionalData) {
                Object.keys(additionalData).forEach((key) => {
                    parseUser.set(key, additionalData[key]);
                });
            }

            await parseUser.signUp();

            // Fetch fresh user data
            await parseUser.fetch();

            setUser(parseUser);
            setProfile(fetchProfile(parseUser));
        } catch (error) {
            throw new Error(handleParseError(error));
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, signUp }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
