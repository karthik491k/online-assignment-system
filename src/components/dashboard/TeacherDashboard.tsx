import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, ClipboardCheck, Clock, CheckCircle, Plus, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardStats {
  totalAssignments: number;
  totalSubmissions: number;
  pendingGrading: number;
  gradedSubmissions: number;
}

interface RecentSubmission {
  id: string;
  file_name: string;
  submitted_at: string;
  status: string;
  assignment: { title: string } | null;
  student: { full_name: string } | null;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalAssignments: 0,
    totalSubmissions: 0,
    pendingGrading: 0,
    gradedSubmissions: 0,
  });
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch assignments count
      const { count: assignmentsCount } = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user!.id);

      // Fetch submissions stats
      const { data: submissions } = await supabase
        .from('submissions')
        .select('status');

      const totalSubmissions = submissions?.length || 0;
      const pendingGrading = submissions?.filter(s => s.status === 'submitted').length || 0;
      const gradedSubmissions = submissions?.filter(s => s.status === 'graded').length || 0;

      setStats({
        totalAssignments: assignmentsCount || 0,
        totalSubmissions,
        pendingGrading,
        gradedSubmissions,
      });

      // Fetch recent submissions
      const { data: recent } = await supabase
        .from('submissions')
        .select(`
          id,
          file_name,
          submitted_at,
          status,
          assignment:assignments(title),
          student:profiles!submissions_student_id_fkey(full_name)
        `)
        .order('submitted_at', { ascending: false })
        .limit(5);

      setRecentSubmissions((recent as unknown as RecentSubmission[]) || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
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
      title: 'Total Submissions',
      value: stats.totalSubmissions,
      icon: ClipboardCheck,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Pending Grading',
      value: stats.pendingGrading,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Graded',
      value: stats.gradedSubmissions,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your assignments and grade submissions</p>
        </div>
        <Link to="/assignments/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Assignment
          </Button>
        </Link>
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

      {/* Recent Submissions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Submissions</CardTitle>
          <Link to="/submissions">
            <Button variant="ghost" size="sm" className="gap-1">
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : recentSubmissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No submissions yet. Create an assignment to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {recentSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{submission.assignment?.title || 'Unknown Assignment'}</p>
                    <p className="text-sm text-muted-foreground">
                      by {submission.student?.full_name || 'Unknown Student'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground hidden sm:block">
                      {format(new Date(submission.submitted_at), 'MMM d, yyyy')}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                        submission.status === 'graded'
                          ? 'status-graded'
                          : submission.status === 'submitted'
                          ? 'status-submitted'
                          : 'status-pending'
                      }`}
                    >
                      {submission.status}
                    </span>
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
