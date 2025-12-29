import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, CheckCircle, Award, ArrowRight, CalendarDays } from 'lucide-react';
import { format, isPast, isFuture, differenceInDays } from 'date-fns';

interface DashboardStats {
  totalAssignments: number;
  pendingSubmissions: number;
  submittedCount: number;
  gradedCount: number;
  averageGrade: number | null;
}

interface UpcomingAssignment {
  id: string;
  title: string;
  subject: string;
  due_date: string;
  max_score: number;
  hasSubmitted: boolean;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalAssignments: 0,
    pendingSubmissions: 0,
    submittedCount: 0,
    gradedCount: 0,
    averageGrade: null,
  });
  const [upcomingAssignments, setUpcomingAssignments] = useState<UpcomingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch all assignments
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*')
        .order('due_date', { ascending: true });

      // Fetch student's submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select('*, assignment:assignments(title)')
        .eq('student_id', user!.id);

      const totalAssignments = assignments?.length || 0;
      const submittedIds = new Set(submissions?.map(s => s.assignment_id) || []);
      const pendingSubmissions = (assignments?.filter(a => !submittedIds.has(a.id) && isFuture(new Date(a.due_date))).length) || 0;
      const submittedCount = submissions?.filter(s => s.status === 'submitted').length || 0;
      const gradedSubmissions = submissions?.filter(s => s.status === 'graded') || [];
      const gradedCount = gradedSubmissions.length;
      
      let averageGrade = null;
      if (gradedSubmissions.length > 0) {
        const totalGrade = gradedSubmissions.reduce((sum, s) => sum + (s.grade || 0), 0);
        averageGrade = Math.round(totalGrade / gradedSubmissions.length);
      }

      setStats({
        totalAssignments,
        pendingSubmissions,
        submittedCount,
        gradedCount,
        averageGrade,
      });

      // Get upcoming assignments (not yet submitted and due in future)
      const upcoming = assignments
        ?.filter(a => isFuture(new Date(a.due_date)))
        .slice(0, 5)
        .map(a => ({
          ...a,
          hasSubmitted: submittedIds.has(a.id),
        })) || [];

      setUpcomingAssignments(upcoming);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemaining = (dueDate: string) => {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `${days} days left`;
  };

  const statCards = [
    {
      title: 'Total Assignments',
      value: stats.totalAssignments,
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Pending',
      value: stats.pendingSubmissions,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Submitted',
      value: stats.submittedCount,
      icon: CheckCircle,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Average Grade',
      value: stats.averageGrade !== null ? `${stats.averageGrade}%` : 'N/A',
      icon: Award,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground mt-1">Track your assignments and submissions</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{loading ? '...' : stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upcoming Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Upcoming Assignments</CardTitle>
          <Link to="/assignments">
            <Button variant="ghost" size="sm" className="gap-1">
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : upcomingAssignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No upcoming assignments. You're all caught up!
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{assignment.title}</p>
                      <Badge variant="outline" className="hidden sm:inline-flex">
                        {assignment.subject}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>{format(new Date(assignment.due_date), 'MMM d, yyyy')}</span>
                      <span className="text-warning font-medium">
                        • {getDaysRemaining(assignment.due_date)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {assignment.hasSubmitted ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Submitted
                      </Badge>
                    ) : (
                      <Link to={`/assignments/${assignment.id}/submit`}>
                        <Button size="sm">Submit</Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
