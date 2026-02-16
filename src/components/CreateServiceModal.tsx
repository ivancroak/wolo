"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateService } from "@/hooks/use-services";
import { insertServiceSchema } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useCallback, useRef } from "react";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

// --- Offer (List Service) schema ---
const offerSchema = insertServiceSchema.omit({ creatorId: true }).extend({
  price: z.coerce.number().min(0.001, "Price must be positive"),
  pricingCategory: z.enum(["pay_per_action", "full_service", "payroll"]),
  payrollBasis: z.enum(["daily", "weekly", "monthly", "annually", "custom"]).nullable().optional(),
  maxActions: z.coerce.number().int().min(1, "Must be at least 1").nullable().optional(),
  budgetCap: z.coerce.number().min(0.01, "Must be at least 0.01").nullable().optional(),
}).refine(
  (data) => data.pricingCategory !== "payroll" || data.payrollBasis != null,
  { message: "Please select a payroll basis", path: ["payrollBasis"] }
).refine(
  (data) => {
    if (data.pricingCategory === "pay_per_action") {
      return (data.maxActions != null && data.maxActions > 0) || (data.budgetCap != null && data.budgetCap > 0);
    }
    return true;
  },
  { message: "Set at least one: actions cap or budget cap", path: ["maxActions"] }
);

// --- Request schema ---
const requestSchema = insertServiceSchema.omit({ creatorId: true }).extend({
  price: z.coerce.number().min(0.001, "Budget must be positive"),
  deadlineDays: z.coerce.number().int().min(1, "Must be at least 1 day").nullable().optional(),
});

interface CreateServiceModalProps {
  listingType?: "offer" | "request";
}

export function CreateServiceModal({ listingType = "offer" }: CreateServiceModalProps) {
  const isRequest = listingType === "request";

  return isRequest ? <RequestServiceModal /> : <OfferServiceModal />;
}

// ===== OFFER (List Service) Modal =====

function OfferServiceModal() {
  const [open, setOpen] = useState(false);
  const { mutate: createService, isPending } = useCreateService();
  const { toast } = useToast();
  const lastEditedRef = useRef<"price" | "maxActions" | "budgetCap" | null>(null);

  const form = useForm<z.infer<typeof offerSchema>>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "custom",
      listingType: "offer",
      pricingCategory: "pay_per_action",
      payrollBasis: null,
      maxActions: null,
      budgetCap: null,
      price: 0,
      imageUrl: "",
      active: true,
    },
  });

  const autoCalibrate = useCallback((changed: "price" | "maxActions" | "budgetCap") => {
    lastEditedRef.current = changed;
    if (form.getValues("pricingCategory") !== "pay_per_action") return;

    const p = form.getValues("price");
    const a = form.getValues("maxActions");
    const b = form.getValues("budgetCap");

    const hasPrice = typeof p === "number" && p > 0;
    const hasActions = typeof a === "number" && a > 0;
    const hasBudget = typeof b === "number" && b > 0;

    if ([hasPrice, hasActions, hasBudget].filter(Boolean).length < 2) return;

    if (changed === "price" || changed === "maxActions") {
      if (hasPrice && hasActions) {
        form.setValue("budgetCap", Math.round(p * a * 100) / 100, { shouldValidate: true });
      }
    } else if (changed === "budgetCap") {
      if (hasPrice && hasBudget) {
        form.setValue("maxActions", Math.ceil(b / p), { shouldValidate: true });
      }
    }
  }, [form]);

  function onSubmit(values: z.infer<typeof offerSchema>) {
    const payload = {
      ...values,
      maxActions: values.pricingCategory === "pay_per_action" ? (values.maxActions || null) : null,
      budgetCap: values.pricingCategory === "pay_per_action" && values.budgetCap ? String(values.budgetCap) : null,
    };
    createService(payload as any, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast({ title: "Service Created", description: "Your service is now listed on the marketplace." });
      },
      onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    });
  }

  const pricingCategory = form.watch("pricingCategory");

  const priceLabel = pricingCategory === "pay_per_action"
    ? "Price per Action (SOL)"
    : pricingCategory === "payroll"
      ? "Rate (SOL)"
      : "Price (SOL)";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full" data-testid="button-list-service">
          <Plus className="mr-2 h-4 w-4" />
          List Service
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]" data-testid="modal-create-service">
        <DialogHeader>
          <DialogTitle className="text-lg">Create New Service</DialogTitle>
          <DialogDescription>Offer your social influence to the marketplace.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Retweet to 10k followers" {...field} data-testid="input-service-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="repost">Repost</SelectItem>
                      <SelectItem value="like">Like</SelectItem>
                      <SelectItem value="follow">Follow</SelectItem>
                      <SelectItem value="ambassador">Ambassador</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pricingCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pricing Model</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value !== "payroll") form.setValue("payrollBasis", null);
                        if (value !== "pay_per_action") {
                          form.setValue("maxActions", null);
                          form.setValue("budgetCap", null);
                        }
                      }}
                      value={field.value}
                      className="flex gap-4"
                      data-testid="radio-pricing-category"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pay_per_action" id="pay_per_action" />
                        <Label htmlFor="pay_per_action" className="text-sm cursor-pointer">Pay Per Action</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="full_service" id="full_service" />
                        <Label htmlFor="full_service" className="text-sm cursor-pointer">Full Service</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="payroll" id="payroll" />
                        <Label htmlFor="payroll" className="text-sm cursor-pointer">Payroll</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{priceLabel}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setTimeout(() => autoCalibrate("price"), 0);
                      }}
                      data-testid="input-price"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {pricingCategory === "payroll" && (
              <FormField
                control={form.control}
                name="payrollBasis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payroll Basis</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payroll-basis">
                          <SelectValue placeholder="Select payroll basis" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {pricingCategory === "pay_per_action" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxActions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actions Cap</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 100"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            field.onChange(e.target.value ? Number(e.target.value) : null);
                            setTimeout(() => autoCalibrate("maxActions"), 0);
                          }}
                          data-testid="input-max-actions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budgetCap"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Cap (SOL)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="e.g. 10"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            field.onChange(e.target.value ? Number(e.target.value) : null);
                            setTimeout(() => autoCalibrate("budgetCap"), 0);
                          }}
                          data-testid="input-budget-cap"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="col-span-2 text-xs text-muted-foreground -mt-2">
                  price &times; actions = budget &mdash; set any two, the third auto-calculates.
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe exactly what you will do..."
                      className="min-h-[100px]"
                      {...field}
                      data-testid="input-service-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} value={field.value || ""} data-testid="input-image-url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} data-testid="button-cancel-create">Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-create-listing">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                List Service
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ===== REQUEST (Request Service) Modal =====

function RequestServiceModal() {
  const [open, setOpen] = useState(false);
  const { mutate: createService, isPending } = useCreateService();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "custom",
      listingType: "request",
      pricingCategory: "full_service",
      price: 0,
      deadlineDays: null,
      imageUrl: "",
      active: true,
    },
  });

  function onSubmit(values: z.infer<typeof requestSchema>) {
    createService(values as any, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast({ title: "Request Created", description: "Your service request is now listed on the marketplace." });
      },
      onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full" variant="outline" data-testid="button-request-service">
          <Plus className="mr-2 h-4 w-4" />
          Request Service
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]" data-testid="modal-request-service">
        <DialogHeader>
          <DialogTitle className="text-lg">Request a Service</DialogTitle>
          <DialogDescription>Describe the service you need from the marketplace.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What do you need?</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Need 50 retweets from crypto influencers" {...field} data-testid="input-service-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="repost">Repost</SelectItem>
                      <SelectItem value="like">Like</SelectItem>
                      <SelectItem value="follow">Follow</SelectItem>
                      <SelectItem value="ambassador">Ambassador</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Budget (SOL)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} data-testid="input-price" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deadlineDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deadline (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 7"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        data-testid="input-deadline-days"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requirements</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe exactly what you need: target audience, post links, tone, any specific instructions..."
                      className="min-h-[120px]"
                      {...field}
                      data-testid="input-service-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://x.com/post/..." {...field} value={field.value || ""} data-testid="input-image-url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} data-testid="button-cancel-create">Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-create-listing">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Post Request
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
