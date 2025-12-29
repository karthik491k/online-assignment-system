import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, CalendarDays, BookOpen, Loader2, CheckCircle } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  due_date: string;
  max_score: number;
  created_at: string;
}

interface StudentSubmission {
  assignment_id: string;
  status: string;
  grade: number | null;
}

export default function Assignments() {
  const { user, role } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<Map<string, StudentSubmission>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');

  useEffect(() => {
    fetchAssignments();
  }, [user, role]);

  const fetchAssignments = async () => {
    try {
      let query = supabase.from('assignments').select('*').order('due_date', { ascending: true });

      if (role === 'teacher') {
        query = query.eq('created_by', user!.id);
      }

      const { data } = await query;
      setAssignments(data || []);

      if (role === 'student' && data) {
        const { data: submissions } = await supabase
          .from('submissions')
          .select('assignment_id, status, grade')
          .eq('student_id', user!.id);

        const submissionsMap = new Map<string, StudentSubmission>();
        submissions?.forEach(s => {
          submissionsMap.set(s.assignment_id, s);
        });
        setStudentSubmissions(submissionsMap);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const subjects = [...new Set(assignments.map(a => a.subject))];

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = subjectFilter === 'all' || assignment.subject === subjectFilter;
    return matchesSearch && matchesSubject;
  });

  const getAssignmentStatus = (assignment: Assignment) => {
    if (role === 'student') {
      const submission = studentSubmissions.get(assignment.id);
      if (submission) {
        return submission.status;
      }
    }
    if (isPast(new Date(assignment.due_date))) {
      return 'overdue';
    }
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'graded':
        return <Badge className="status-graded">Graded</Badge>;
      case 'submitted':
        return <Badge className="status-submitted">Submitted</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge className="status-pending">Pending</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {role === 'teacher' ? 'Manage Assignments' : 'My Assignments'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {role === 'teacher'
                ? 'Create and manage your course assignments'
                : 'View and submit your assignments'}
            </p>
          </div>
          {role === 'teacher' && (
            <Link to="/assignments/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Assignment
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(subject => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Assignments Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredAssignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No assignments found</h3>
              <p className="text-muted-foreground text-center mt-1">
                {role === 'teacher'
                  ? "Create your first assignment to get started"
                  : "Check back later for new assignments"}
              </p>
              {role === 'teacher' && (
                <Link to="/assignments/new" className="mt-4">
                  <Button>Create Assignment</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAssignments.map((assignment) => {
              const status = getAssignmentStatus(assignment);
              const submission = studentSubmissions.get(assignment.id);
              
              return (
                <Card key={assignment.id} className="card-hover flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline">{assignment.subject}</Badge>
                      {getStatusBadge(status)}
                    </div>
                    <CardTitle className="text-lg mt-2 line-clamp-2">
                      {assignment.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    {assignment.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {assignment.description}
                      </p>
                    )}
                    <div className="mt-auto space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                          <span>Due: {format(new Date(assignment.due_date), 'MMM d, yyyy')}</span>
                        </div>
                        <span className="font-medium">{assignment.max_score} pts</span>
                      </div>
                      
                      {role === 'student' ? (
                        submission ? (
                          <div className="flex items-center justify-between">
                            {submission.status === 'graded' && (
                              <span className="text-sm font-medium text-success">
                                Grade: {submission.grade}/{assignment.max_score}
                              </span>
                            )}
                            <Link to={`/my-submissions`} className="ml-auto">
                              <Button variant="outline" size="sm">
                                View Submission
                              </Button>
                            </Link>
                          </div>
                        ) : (
                          <Link to={`/assignments/${assignment.id}/submit`}>
                            <Button className="w-full" size="sm">
                              Submit Assignment
                            </Button>
                          </Link>
                        )
                      ) : (
                        <Link to={`/assignments/${assignment.id}`}>
                          <Button variant="outline" className="w-full" size="sm">
                            View Details
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
