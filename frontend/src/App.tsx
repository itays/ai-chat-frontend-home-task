import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BACKEND_URL } from './config.ts';

export const App = () => (
  <main className="flex min-h-svh items-center justify-center bg-background p-6">
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Start here</CardTitle>
        <CardDescription>The backend is running at {BACKEND_URL}.</CardDescription>
      </CardHeader>
      <CardContent>
        <Input aria-label="Message" placeholder="Type a message…" />
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Send</Button>
      </CardFooter>
    </Card>
  </main>
);
