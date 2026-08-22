"use client";

import { CheckCircle2Icon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/v-form-8-utils/button";
import { Checkbox } from "@/components/ui/v-form-8-utils/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/v-form-8-utils/field";
import { Form } from "@/components/ui/v-form-8-utils/form";
import { Input } from "@/components/ui/v-form-8-utils/input";
import { Label } from "@/components/ui/v-form-8-utils/label";
import { Radio, RadioGroup } from "@/components/ui/v-form-8-utils/radio-group";

const STEPS = ["Account", "Plan", "Confirm"] as const;
type Step = 0 | 1 | 2;

const plans = [
  {
    description: "Free forever, up to 3 projects",
    id: "hobby",
    label: "Hobby",
  },
  { description: "$12/mo — unlimited projects", id: "pro", label: "Pro" },
  { description: "$49/mo — collaboration tools", id: "team", label: "Team" },
];

export function Pattern() {
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [data, setData] = useState({
    email: "",
    name: "",
    newsletter: true,
    plan: "hobby",
  });

  const handleAccount = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setData((d) => ({
      ...d,
      email: fd.get("email") as string,
      name: fd.get("name") as string,
    }));
    setStep(1);
  };

  const handlePlan = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setData((d) => ({
      ...d,
      newsletter: fd.get("newsletter") === "on",
      plan: fd.get("plan") as string,
    }));
    setStep(2);
  };

  const handleConfirm = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2Icon className="size-6 text-success" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">Account created!</p>
          <p className="text-muted-foreground text-sm">
            Welcome, {data.name}. Check your inbox to verify your email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div className="flex items-center gap-2" key={label}>
            <div className="flex items-center gap-1.5">
              <div
                className={`flex size-6 items-center justify-center rounded-full font-semibold text-xs transition-colors ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted-foreground"
                }`}
              >
                {i < step ? <CheckCircle2Icon className="size-3.5" /> : i + 1}
              </div>
              <span className={`font-medium text-xs ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px min-w-6 flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Form className="gap-4" onSubmit={handleAccount}>
          <Field name="name">
            <FieldLabel>Full name</FieldLabel>
            <Input defaultValue={data.name} name="name" placeholder="Alex Rivera" required />
            <FieldError />
          </Field>
          <Field name="email">
            <FieldLabel>Email</FieldLabel>
            <Input defaultValue={data.email} name="email" placeholder="you@example.com" required type="email" />
            <FieldError />
          </Field>
          <Button className="w-full" type="submit">
            Continue
          </Button>
        </Form>
      )}

      {step === 1 && (
        <Form className="gap-4" onSubmit={handlePlan}>
          <Field name="plan">
            <FieldLabel>Choose a plan</FieldLabel>
            <RadioGroup className="gap-3" defaultValue={data.plan} name="plan">
              {plans.map((p) => (
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-accent/50"
                  key={p.id}
                >
                  <Radio className="mt-0.5" value={p.id} />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">{p.label}</span>
                    <span className="text-muted-foreground text-xs">{p.description}</span>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </Field>
          <Label className="flex items-center gap-2 font-normal text-sm">
            <Checkbox defaultChecked={data.newsletter} name="newsletter" />
            Send me product updates and tips
          </Label>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => setStep(0)} type="button" variant="outline">
              Back
            </Button>
            <Button className="flex-1" type="submit">
              Continue
            </Button>
          </div>
        </Form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="divide-y divide-border rounded-lg border border-border">
            {[
              { label: "Name", value: data.name },
              { label: "Email", value: data.email },
              {
                label: "Plan",
                value: plans.find((p) => p.id === data.plan)?.label ?? data.plan,
              },
              { label: "Updates", value: data.newsletter ? "Yes" : "No" },
            ].map(({ label, value }) => (
              <div className="flex items-center justify-between px-4 py-3 text-sm" key={label}>
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => setStep(1)} type="button" variant="outline">
              Back
            </Button>
            <Button className="flex-1" loading={loading} onClick={handleConfirm}>
              Create account
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Pattern;
