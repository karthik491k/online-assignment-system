import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Loader2, Download, FileText, CheckCircle } from 'lucide-react';
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
  } | null;
  student: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export default function Submissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [gradeValue, setGradeValue] = useState('');
  const [feedbackValue, setFeedbackValue] = useState('');
  const [isGrading, setIsGrading] = useState(false);

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
          assignment:assignments(id, title, subject, max_score),
          student:profiles!submissions_student_id_fkey(id, full_name, email)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions((data as unknown as Submission[]) || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (submission: Submission) => {
    try {
      const { data, error } = await supabase.storage
        .from('submissions')
        .download(submission.file_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = submission.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error('Failed to download file');
    }
  };

  const openGradeDialog = (submission: Submission) => {
    setSelectedSubmission(submission);
    setGradeValue(submission.grade?.toString() || '');
    setFeedbackValue(submission.feedback || '');
    setGradeDialogOpen(true);
  };

  const handleGradeSubmit = async () => {
    if (!selectedSubmission) return;

    const grade = Number(gradeValue);
    if (isNaN(grade) || grade < 0 || grade > (selectedSubmission.assignment?.max_score || 100)) {
      toast.error(`Grade must be between 0 and ${selectedSubmission.assignment?.max_score || 100}`);
      return;
    }

    setIsGrading(true);

    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          grade,
          feedback: feedbackValue || null,
          status: 'graded',
          graded_at: new Date().toISOString(),
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      toast.success('Submission graded successfully!');
      setGradeDialogOpen(false);
      fetchSubmissions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to grade submission');
    } finally {
      setIsGrading(false);
    }
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch =
      submission.assignment?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.student?.full_name.toLowerCase().includes(searchQuery.toLowerCase());
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">All Submissions</h1>
          <p className="text-muted-foreground mt-1">
            Review and grade student submissions
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by assignment or student..."
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
              <h3 className="text-lg font-medium">No submissions found</h3>
              <p className="text-muted-foreground text-center mt-1">
                Submissions will appear here once students submit their work
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredSubmissions.map((submission) => (
              <Card key={submission.id} className="card-hover">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">
                          {submission.assignment?.subject}
                        </Badge>
                        {getStatusBadge(submission.status)}
                      </div>
                      <h3 className="font-semibold text-lg">
                        {submission.assignment?.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Submitted by {submission.student?.full_name} •{' '}
                        {format(new Date(submission.submitted_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      {submission.status === 'graded' && (
                        <p className="text-sm font-medium text-success mt-2">
                          Grade: {submission.grade}/{submission.assignment?.max_score}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleDownload(submission)}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => openGradeDialog(submission)}
                      >
                        {submission.status === 'graded' ? (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Update Grade
                          </>
                        ) : (
                          'Grade'
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Grade Dialog */}
      <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>
              {selectedSubmission?.assignment?.title} -{' '}
              {selectedSubmission?.student?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="grade">
                Grade (Max: {selectedSubmission?.assignment?.max_score})
              </Label>
              <Input
                id="grade"
                type="number"
                min={0}
                max={selectedSubmission?.assignment?.max_score}
                value={gradeValue}
                onChange={(e) => setGradeValue(e.target.value)}
                placeholder="Enter grade"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback (Optional)</Label>
              <Textarea
                id="feedback"
                value={feedbackValue}
                onChange={(e) => setFeedbackValue(e.target.value)}
                placeholder="Provide feedback for the student..."
                rows={4}
              />
            </div>
            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setGradeDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleGradeSubmit}
                disabled={isGrading || !gradeValue}
              >
                {isGrading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Grade'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
