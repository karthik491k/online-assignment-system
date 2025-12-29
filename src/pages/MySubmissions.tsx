import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Search, Loader2, FileText, MessageSquare, Award } from 'lucide-react';
import { format } from 'date-fns';

interface Submission {
  id: string;
  file_url: string;
  file_name: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  status: string;
  assignment: {
    id: string;
    title: string;
    subject: string;
    max_score: number;
    due_date: string;
  } | null;
}

export default function MySubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchSubmissions();
  }, [user]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          file_url,
          file_name,
          submitted_at,
          grade,
          feedback,
          status,
          assignment:assignments(id, title, subject, max_score, due_date)
        `)
        .eq('student_id', user!.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions((data as unknown as Submission[]) || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch =
      submission.assignment?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.assignment?.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || submission.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'graded':
        return <Badge className="status-graded">Graded</Badge>;
      case 'submitted':
        return <Badge className="status-submitted">Submitted</Badge>;
      default:
        return <Badge className="status-pending">Pending</Badge>;
    }
  };

  const getGradeColor = (grade: number, maxScore: number) => {
    const percentage = (grade / maxScore) * 100;
    if (percentage >= 90) return 'text-success';
    if (percentage >= 70) return 'text-primary';
    if (percentage >= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Submissions</h1>
          <p className="text-muted-foreground mt-1">
            Track your submitted assignments and view grades
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search submissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="graded">Graded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No submissions yet</h3>
              <p className="text-muted-foreground text-center mt-1">
                Your submitted assignments will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {filteredSubmissions.map((submission) => (
              <AccordionItem
                key={submission.id}
                value={submission.id}
                className="border rounded-lg bg-card px-6 card-hover"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-left w-full mr-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">
                          {submission.assignment?.subject}
                        </Badge>
                        {getStatusBadge(submission.status)}
                      </div>
                      <h3 className="font-semibold">
                        {submission.assignment?.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Submitted: {format(new Date(submission.submitted_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    {submission.status === 'graded' && submission.grade !== null && (
                      <div className="flex items-center gap-2">
                        <Award className={`h-5 w-5 ${getGradeColor(submission.grade, submission.assignment?.max_score || 100)}`} />
                        <span className={`text-2xl font-bold ${getGradeColor(submission.grade, submission.assignment?.max_score || 100)}`}>
                          {submission.grade}/{submission.assignment?.max_score}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          File Submitted
                        </p>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm">{submission.file_name}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Due Date
                        </p>
                        <span className="text-sm">
                          {format(new Date(submission.assignment?.due_date || ''), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    {submission.status === 'graded' && (
                      <>
                        {submission.feedback && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Teacher Feedback
                            </p>
                            <div className="p-4 rounded-lg bg-muted/50">
                              <p className="text-sm">{submission.feedback}</p>
                            </div>
                          </div>
                        )}
                        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Your Grade</span>
                            <span className={`text-xl font-bold ${getGradeColor(submission.grade!, submission.assignment?.max_score || 100)}`}>
                              {submission.grade}/{submission.assignment?.max_score} (
                              {Math.round((submission.grade! / (submission.assignment?.max_score || 100)) * 100)}%)
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    {submission.status === 'submitted' && (
                      <div className="p-4 rounded-lg bg-info/10 border border-info/20">
                        <p className="text-sm text-info">
                          Your submission is awaiting review by the teacher.
                        </p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </Layout>
  );
}
