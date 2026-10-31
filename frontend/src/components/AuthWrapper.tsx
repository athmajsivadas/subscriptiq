import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, Mail, Lock, User as UserIcon } from "lucide-react";

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Clear form fields on logout for security
      if (!session?.user) {
        setEmail("");
        setPassword("");
        setFirstName("");
        setLastName("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Error signing in",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You've been successfully signed in.",
      });
    }

    setAuthLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (error) {
      toast({
        title: "Error signing up",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account created!",
        description: "Welcome to FinanceFlow! Your account has been created successfully.",
      });
    }

    setAuthLoading(false);
  };

  const handleDemoLogin = async () => {
    setAuthLoading(true);
    
    const demoEmail = "demo@financeflow.app";
    const demoPassword = "demo123456";

    try {
      // First try to sign in with existing demo account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInError) {
        // If demo account doesn't exist, create it
        const { error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
          options: {
            data: {
              first_name: "Demo",
              last_name: "User",
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        // After creating, sign in
        const { error: signInAfterSignUpError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });

        if (signInAfterSignUpError) {
          throw signInAfterSignUpError;
        }
      }

      // Ensure demo user profile is properly configured
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: setupError } = await supabase.rpc('setup_demo_user_profile', {
          demo_user_id: user.id
        });

        if (setupError) {
          console.error('Error setting up demo profile:', setupError);
        }
      }

      toast({
        title: "Welcome to the Demo!",
        description: "You're now exploring FinanceFlow with sample data.",
      });
    } catch (error: any) {
      toast({
        title: "Demo login failed",
        description: error.message || "Unable to access demo account. Please try again.",
        variant: "destructive",
      });
    }

    setAuthLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="w-full max-w-md p-8">
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-7 h-7 text-primary-foreground" />
              </div>
              <h1 className="text-2xl">Welcome to FinanceFlow</h1>
              <p className="text-muted-foreground mt-2">
                {isSignUp ? "Create your account to get started" : "Sign in to your dashboard"}
              </p>
            </div>

            <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
              {isSignUp && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      placeholder="Doe"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="pl-10"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="pl-10"
                    autoComplete="off"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90"
                disabled={authLoading}
              >
                {authLoading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
              </Button>
            </form>

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleDemoLogin}
                disabled={authLoading}
              >
              <UserIcon className="w-4 h-4 mr-2" />
                {authLoading ? "Please wait..." : "Try Demo"}
              </Button>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover:underline"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </Card>
        </div>

        <div className="hidden lg:flex flex-1 bg-gradient-primary p-8 items-center justify-center text-primary-foreground">
          <div className="max-w-md text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-8 opacity-90" />
            <h2 className="text-3xl mb-4">Financial Intelligence</h2>
            <p className="text-lg opacity-90 leading-relaxed">
              Transform your business with comprehensive financial analytics, real-time insights, 
              and powerful reporting tools designed for modern businesses.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}