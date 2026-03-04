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
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const offerSchema = insertServiceSchema.omit({ creatorId: true }).extend({
  price: z.coerce.number().min(0.001, "Price must be positive"),
  pricingCategory: z.enum(["fixed", "payroll"]),
  payrollBasis: z.enum(["weekly", "monthly"]).nullable().optional(),
  contentType: z.enum(["posts", "threads", "mixed"]),
  maxActions: z.coerce.number().int().min(1, "Must be at least 1").nullable().optional(),
  requiredKeyword: z.string().nullable().optional(),
  minPostCount: z.coerce.number().int().min(1).nullable().optional(),
  postsPerPeriod: z.coerce.number().int().min(1).nullable().optional(),
  threadsPerPeriod: z.coerce.number().int().min(1).nullable().optional(),
}).refine(
  (data) => data.pricingCategory !== "payroll" || data.payrollBasis != null,
  { message: "Please select a payroll basis (period)", path: ["payrollBasis"] }
).refine(
  (data) => data.pricingCategory === "payroll" || data.contentType !== "mixed",
  { message: "Mixed content is only available for payroll pricing", path: ["contentType"] }
);

const requestSchema = insertServiceSchema.omit({ creatorId: true }).extend({
  price: z.coerce.number().min(0.001, "Budget must be positive"),
  pricingCategory: z.enum(["fixed", "payroll"]),
  payrollBasis: z.enum(["weekly", "monthly"]).nullable().optional(),
  contentType: z.enum(["posts", "threads", "mixed"]),
  deadlineDays: z.coerce.number().int().min(1, "Must be at least 1 day").nullable().optional(),
  requiredKeyword: z.string().min(1, "Required keyword is mandatory"),
  minPostCount: z.coerce.number().int().min(1).nullable().optional(),
  postsPerPeriod: z.coerce.number().int().min(1).nullable().optional(),
  threadsPerPeriod: z.coerce.number().int().min(1).nullable().optional(),
  showTwitterHandle: z.boolean().optional(),
}).refine(
  (data) => data.pricingCategory === "payroll" || data.contentType !== "mixed",
  { message: "Mixed content is only available for payroll pricing", path: ["contentType"] }
);

interface CreateServiceModalProps {
  listingType?: "offer" | "request";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateServiceModal({ listingType = "offer", open, onOpenChange }: CreateServiceModalProps) {
  const isRequest = listingType === "request";
  return isRequest
    ? <RequestServiceModal externalOpen={open} onExternalOpenChange={onOpenChange} />
    : <OfferServiceModal externalOpen={open} onExternalOpenChange={onOpenChange} />;
}

interface ModalControlProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

function OfferServiceModal({ externalOpen, onExternalOpenChange }: ModalControlProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onExternalOpenChange?.(v);
  };
  const { mutate: createService, isPending } = useCreateService();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof offerSchema>>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "content",
      listingType: "offer",
      pricingCategory: "fixed",
      payrollBasis: null,
      contentType: "posts",
      maxActions: null,
      requiredKeyword: null,
      minPostCount: null,
      postsPerPeriod: null,
      threadsPerPeriod: null,
      deadlineDays: null,
      price: 0,
      imageUrl: "",
      active: true,
    },
  });

  function onSubmit(values: z.infer<typeof offerSchema>) {
    createService(values as any, {
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
  const contentType = form.watch("contentType");

  const priceLabel = pricingCategory === "payroll" ? "Rate per Period (SOL)" : "Contract Price (SOL)";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full" data-testid="button-list-service">
          <Plus className="mr-2 h-4 w-4" />
          List Service
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto" data-testid="modal-create-service">
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
                    <Input placeholder="e.g. DeFi Content Campaign" {...field} data-testid="input-service-title" />
                  </FormControl>
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
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== "payroll") {
                        form.setValue("payrollBasis", null);
                        form.setValue("postsPerPeriod", null);
                        form.setValue("threadsPerPeriod", null);
                        const ct = form.getValues("contentType");
                        if (ct === "mixed") form.setValue("contentType", "posts");
                      }
                      if (value !== "fixed") {
                        form.setValue("minPostCount", null);
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-pricing-category">
                        <SelectValue placeholder="Select pricing model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Contract</SelectItem>
                      <SelectItem value="payroll">Payroll</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value === "posts") form.setValue("threadsPerPeriod", null);
                      if (value === "threads") form.setValue("postsPerPeriod", null);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-content-type">
                        <SelectValue placeholder="Select content type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="posts">Posts</SelectItem>
                      <SelectItem value="threads">Threads</SelectItem>
                      {pricingCategory === "payroll" && (
                        <SelectItem value="mixed">Mixed</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
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
                    <Input type="number" min="0" step="0.01" {...field} data-testid="input-price" />
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
                    <FormLabel>Payroll Basis (Period)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payroll-basis">
                          <SelectValue placeholder="Select payroll basis (period)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="requiredKeyword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keywords (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. DeFi, Solana, NFT"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      data-testid="input-required-keyword"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {pricingCategory === "fixed" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minPostCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{contentType === "threads" ? "Min Thread Count" : "Min Post Count"}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 5"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          data-testid="input-min-post-count"
                        />
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
            )}

            {pricingCategory === "payroll" && (
              <div className="grid grid-cols-2 gap-4">
                {(contentType === "posts" || contentType === "mixed") && (
                  <FormField
                    control={form.control}
                    name="postsPerPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posts per Period</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="e.g. 3"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            data-testid="input-posts-per-period"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {(contentType === "threads" || contentType === "mixed") && (
                  <FormField
                    control={form.control}
                    name="threadsPerPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Threads per Period</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="e.g. 2"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            data-testid="input-threads-per-period"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="deadlineDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Optional"
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
            )}

            <FormField
              control={form.control}
              name="maxActions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Buyers of the Service (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Unlimited if empty"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      data-testid="input-max-actions"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

function RequestServiceModal({ externalOpen, onExternalOpenChange }: ModalControlProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onExternalOpenChange?.(v);
  };
  const { mutate: createService, isPending } = useCreateService();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "content",
      listingType: "request",
      pricingCategory: "fixed",
      payrollBasis: null,
      contentType: "posts",
      price: 0,
      deadlineDays: null,
      requiredKeyword: "",
      minPostCount: null,
      postsPerPeriod: null,
      threadsPerPeriod: null,
      imageUrl: "",
      active: true,
      showTwitterHandle: false,
    },
  });

  const pricingCategory = form.watch("pricingCategory");
  const contentType = form.watch("contentType");

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
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto" data-testid="modal-request-service">
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
                    <Input placeholder="e.g. Need 20 posts promoting our token" {...field} data-testid="input-service-title" />
                  </FormControl>
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
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== "payroll") {
                        form.setValue("payrollBasis", null);
                        form.setValue("postsPerPeriod", null);
                        form.setValue("threadsPerPeriod", null);
                        const ct = form.getValues("contentType");
                        if (ct === "mixed") form.setValue("contentType", "posts");
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-pricing-category">
                        <SelectValue placeholder="Select pricing model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Contract</SelectItem>
                      <SelectItem value="payroll">Payroll</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value === "posts") form.setValue("threadsPerPeriod", null);
                      if (value === "threads") form.setValue("postsPerPeriod", null);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-content-type">
                        <SelectValue placeholder="Select content type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="posts">Posts</SelectItem>
                      <SelectItem value="threads">Threads</SelectItem>
                      {pricingCategory === "payroll" && (
                        <SelectItem value="mixed">Mixed</SelectItem>
                      )}
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
                    <FormLabel>{pricingCategory === "payroll" ? "Rate per Period (SOL)" : "Total Budget (SOL)"}</FormLabel>
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

            {pricingCategory === "payroll" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="payrollBasis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payroll Basis (Period)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payroll-basis">
                            <SelectValue placeholder="Select basis (period)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(contentType === "posts" || contentType === "mixed") && (
                  <FormField
                    control={form.control}
                    name="postsPerPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posts per Period</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="e.g. 3"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            data-testid="input-posts-per-period"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {(contentType === "threads" || contentType === "mixed") && (
                  <FormField
                    control={form.control}
                    name="threadsPerPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Threads per Period</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="e.g. 2"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            data-testid="input-threads-per-period"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="requiredKeyword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Required Keyword *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. #SolanaDefi or @woloprotocol"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      data-testid="input-required-keyword"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {pricingCategory === "fixed" && (
              <FormField
                control={form.control}
                name="minPostCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{contentType === "threads" ? "Min Thread Count" : "Min Post Count"}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 20"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        data-testid="input-min-post-count"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

            <FormField
              control={form.control}
              name="showTwitterHandle"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm">Show my X handle</FormLabel>
                    <p className="text-xs text-muted-foreground">Display your @username publicly on this request</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
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
