export type QuestionProgress = {
  name: string;
  attempts: number;
  passed: boolean;
};

export type UserProgressDoc = {
  userId: string;
  questions: QuestionProgress[];
};
