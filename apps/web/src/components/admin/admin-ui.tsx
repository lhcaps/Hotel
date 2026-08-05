'use client';

import * as React from 'react';
import { MoreHorizontalIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';

export function AdminAppShell({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <SidebarProvider defaultOpen className={cn('admin-app-shell', className)}>
      {children}
    </SidebarProvider>
  );
}

export function AdminTopbar({
  eyebrow,
  identity,
  actions,
}: Readonly<{ eyebrow?: React.ReactNode; identity?: React.ReactNode; actions?: React.ReactNode }>) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar__leading">
        <SidebarTrigger aria-label="Toggle navigation" />
        {eyebrow ? <span className="admin-topbar__eyebrow">{eyebrow}</span> : null}
      </div>
      {identity ? <div className="admin-topbar__identity">{identity}</div> : null}
      {actions ? <div className="admin-topbar__actions">{actions}</div> : null}
    </header>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: Readonly<{
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn('admin-page-header', className)}>
      <div className="admin-page-header__copy">
        {eyebrow ? <p className="admin-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="admin-page-header__actions">{actions}</div> : null}
    </div>
  );
}

export function AdminFilterToolbar({
  children,
  onSubmit,
  className,
}: Readonly<{
  children: React.ReactNode;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  className?: string;
}>) {
  return (
    <form className={cn('admin-filter-toolbar', className)} onSubmit={onSubmit}>
      <div className="admin-filter-toolbar__controls">{children}</div>
    </form>
  );
}

export function AdminActiveFilters({
  filters,
  onClear,
}: Readonly<{
  filters: readonly { id: string; label: string; value: string }[];
  onClear: (id: string) => void;
}>) {
  if (filters.length === 0) return null;
  return (
    <div className="admin-active-filters" aria-label="Active filters">
      <span className="admin-active-filters__label">Active filters</span>
      {filters.map((filter) => (
        <Badge key={filter.id} variant="outline" className="admin-filter-chip">
          <span>
            {filter.label}: {filter.value}
          </span>
          <button
            type="button"
            aria-label={`Clear ${filter.label}`}
            onClick={() => onClear(filter.id)}
          >
            <XIcon />
          </button>
        </Badge>
      ))}
    </div>
  );
}

export function AdminDataTable({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return <div className={cn('admin-data-table', className)}>{children}</div>;
}

export function AdminTablePagination({
  page,
  pageCount,
  onPageChange,
  previousLabel = 'Previous',
  nextLabel = 'Next',
}: Readonly<{
  page: number;
  pageCount: number;
  onPageChange?: (page: number) => void;
  previousLabel?: string;
  nextLabel?: string;
}>) {
  return (
    <Pagination className="admin-table-pagination">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text={previousLabel}
            disabled={page === 1}
            onClick={() => {
              if (page === 1 || onPageChange === undefined) return;
              onPageChange(page - 1);
            }}
          />
        </PaginationItem>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((value) => (
          <PaginationItem key={value}>
            <PaginationLink
              isActive={value === page}
              onClick={() => {
                if (onPageChange === undefined) return;
                onPageChange(value);
              }}
            >
              {value}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            text={nextLabel}
            disabled={page === pageCount}
            onClick={() => {
              if (page === pageCount || onPageChange === undefined) return;
              onPageChange(page + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

type AdminStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function AdminStatusBadge({
  tone = 'neutral',
  children,
}: Readonly<{ tone?: AdminStatusTone; children: React.ReactNode }>) {
  return (
    <Badge variant="outline" className={cn('admin-status-badge', `admin-status-badge--${tone}`)}>
      {children}
    </Badge>
  );
}

export function AdminDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}>) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="admin-detail-sheet">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="admin-detail-sheet__body">{children}</div>
        {footer ? <SheetFooter>{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}

export function AdminFormSheet({
  children,
  ...props
}: React.ComponentProps<typeof AdminDetailSheet>) {
  return (
    <AdminDetailSheet {...props}>
      <div className="admin-form-sheet">{children}</div>
    </AdminDetailSheet>
  );
}

export function AdminFormSection({
  title,
  description,
  children,
}: Readonly<{ title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode }>) {
  return (
    <FieldSet className="admin-form-section">
      <FieldLegend>{title}</FieldLegend>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldGroup>{children}</FieldGroup>
    </FieldSet>
  );
}

export function AdminMetric({
  label,
  value,
  detail,
  tone = 'neutral',
}: Readonly<{
  label: React.ReactNode;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: AdminStatusTone;
}>) {
  return (
    <div className={cn('admin-metric', `admin-metric--${tone}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  icon,
  action,
}: Readonly<{
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}>) {
  return (
    <Empty className="admin-empty-state">
      {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <div className="admin-empty-state__action">{action}</div> : null}
    </Empty>
  );
}

export function AdminErrorState({
  title,
  description,
}: Readonly<{ title: React.ReactNode; description?: React.ReactNode }>) {
  return (
    <Alert variant="destructive" className="admin-error-state">
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
    </Alert>
  );
}

export function AdminLoadingState({ label = 'Loading' }: Readonly<{ label?: React.ReactNode }>) {
  return (
    <div className="admin-loading-state" role="status" aria-live="polite">
      <Spinner />
      <span>{label}</span>
      <Skeleton className="admin-loading-state__bar" />
    </div>
  );
}

export function AdminPermissionState({
  title,
  description,
}: Readonly<{ title: React.ReactNode; description?: React.ReactNode }>) {
  return <AdminEmptyState title={title} description={description} />;
}

export type AdminAction = Readonly<{
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}>;

export function AdminResponsiveActions({
  actions,
  children,
}: Readonly<{ actions: readonly AdminAction[]; children?: React.ReactNode }>) {
  return (
    <div className="admin-responsive-actions">
      <div className="admin-responsive-actions__wide">{children}</div>
      <div className="admin-responsive-actions__compact">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon-sm" aria-label="More actions" />}
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                disabled={action.disabled}
                variant={action.destructive ? 'destructive' : 'default'}
                onClick={action.onSelect}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AdminRowActions({
  actions,
  children,
}: Readonly<{ actions: readonly AdminAction[]; children?: React.ReactNode }>) {
  return (
    <AdminResponsiveActions actions={actions}>
      <div className="admin-row-actions">{children}</div>
    </AdminResponsiveActions>
  );
}

export type AdminMultiSelectOption = Readonly<{ value: string; label: string }>;

export function AdminMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select options',
  ariaLabel,
  id,
}: Readonly<{
  options: readonly AdminMultiSelectOption[];
  value: readonly string[];
  onChange: (value: readonly string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
}>) {
  const selected = new Set(value);
  const selectedLabels = options
    .filter((option) => selected.has(option.value))
    .map((option) => option.label);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="admin-multi-select__trigger"
            aria-label={ariaLabel}
            id={id}
          />
        }
      >
        <span className={selectedLabels.length === 0 ? 'text-muted-foreground' : undefined}>
          {selectedLabels.length === 0
            ? placeholder
            : selectedLabels.length === 1
              ? selectedLabels[0]
              : `${selectedLabels.length} selected`}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="admin-multi-select__content">
        <Command>
          <CommandInput placeholder="Search options" />
          <CommandList>
            <CommandEmpty>No matching options.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = selected.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    data-checked={checked ? 'true' : 'false'}
                    onSelect={() => {
                      const next = new Set(selected);
                      if (checked) next.delete(option.value);
                      else next.add(option.value);
                      onChange(
                        options
                          .filter((candidate) => next.has(candidate.value))
                          .map((candidate) => candidate.value),
                      );
                    }}
                  >
                    <Checkbox checked={checked} tabIndex={-1} aria-hidden="true" />
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
