import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  TrendingUp, 
  PieChart, 
  Calculator, 
  FileBarChart, 
  Bell,
  Smartphone,
  Shield,
  CloudUpload,
  Brain,
  Layers,
  Target
} from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: TrendingUp,
      title: "Advanced Analytics",
      description: "Get deep insights into your financial performance with AI-powered analytics",
      status: "available",
      category: "Analytics"
    },
    {
      icon: PieChart,
      title: "Interactive Dashboards",
      description: "Customizable dashboards with real-time data visualization",
      status: "available",
      category: "Visualization"
    },
    {
      icon: Calculator,
      title: "Financial Forecasting",
      description: "Predict future trends and plan your financial strategy",
      status: "coming-soon",
      category: "Planning"
    },
    {
      icon: FileBarChart,
      title: "Automated Reports",
      description: "Generate comprehensive financial reports automatically",
      status: "available",
      category: "Reports"
    },
    {
      icon: Bell,
      title: "Smart Notifications",
      description: "Get alerts for important financial events and milestones",
      status: "beta",
      category: "Alerts"
    },
    {
      icon: Smartphone,
      title: "Mobile App",
      description: "Access your financial data on-the-go with our mobile application",
      status: "coming-soon",
      category: "Mobile"
    },
    {
      icon: Shield,
      title: "Bank-Grade Security",
      description: "Enterprise-level security to protect your sensitive financial data",
      status: "available",
      category: "Security"
    },
    {
      icon: CloudUpload,
      title: "Cloud Backup",
      description: "Automatic backup and sync across all your devices",
      status: "available",
      category: "Storage"
    },
    {
      icon: Brain,
      title: "AI Insights",
      description: "Machine learning algorithms to identify patterns and opportunities",
      status: "beta",
      category: "AI"
    },
    {
      icon: Layers,
      title: "Multi-Currency Support",
      description: "Handle multiple currencies with real-time exchange rates",
      status: "coming-soon",
      category: "International"
    },
    {
      icon: Target,
      title: "Goal Tracking",
      description: "Set and track your financial goals with progress monitoring",
      status: "available",
      category: "Planning"
    },
    {
      icon: Zap,
      title: "API Integration",
      description: "Connect with 500+ financial institutions and services",
      status: "available",
      category: "Integration"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Available</Badge>;
      case "beta":
        return <Badge className="bg-primary-light text-primary hover:bg-primary-light">Beta</Badge>;
      case "coming-soon":
        return <Badge className="bg-muted text-muted-foreground hover:bg-muted">Coming Soon</Badge>;
      default:
        return null;
    }
  };

  const categories = [...new Set(features.map(f => f.category))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl tracking-tight">Features</h1>
        <p className="text-muted-foreground">
          Discover all the powerful features that make FinanceFlow the best choice for your financial management
        </p>
      </div>

      {/* Feature Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Features</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{features.length}</div>
            <p className="text-xs text-muted-foreground">
              Across {categories.length} categories
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Now</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {features.filter(f => f.status === "available").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready to use
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Development</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {features.filter(f => f.status === "coming-soon" || f.status === "beta").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Coming soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Features Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-primary-light rounded-lg">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{feature.category}</p>
                  </div>
                </div>
                {getStatusBadge(feature.status)}
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                {feature.description}
              </CardDescription>
              <Button 
                variant={feature.status === "available" ? "default" : "outline"} 
                size="sm"
                disabled={feature.status === "coming-soon"}
                className="w-full"
              >
                {feature.status === "available" ? "Use Now" : 
                 feature.status === "beta" ? "Try Beta" : "Coming Soon"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feature Request */}
      <Card>
        <CardHeader>
          <CardTitle>Request a Feature</CardTitle>
          <CardDescription>
            Have an idea for a new feature? We'd love to hear from you!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button>Submit Feature Request</Button>
            <Button variant="outline">Join Beta Program</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Features;