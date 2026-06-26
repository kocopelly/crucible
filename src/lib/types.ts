export interface MuscleGroup {
  id: string;
  name: string;
  parent: string | null;
}

export interface Exercise {
  id: string;
  position: string;
  equipment: string;
  target: string;
  angle: string | null;
  movement: string;
  variant: string | null;
  display_name: string;
}

export interface ExerciseMuscle {
  exercise_id: string;
  muscle_group_id: string;
  weight: number;
}

export interface Session {
  id: string;
  date: string;
  started_at: string | null;
  finished_at: string | null;
  notes: string | null;
}

export interface Set {
  id: string;
  session_id: string;
  exercise_id: string;
  set_order: number;
  weight: number;
  reps: number;
  notes: string | null;
}
