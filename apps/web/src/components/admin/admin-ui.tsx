'use client';

import * as React from 'react';
import {
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  MoreHorizontalIcon,
  SearchIcon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { translate } from '@/lib/i18n/messages';
import { useLocale } from '@/components/locale-provider';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function AdminAppShell({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  variant?: 'operational' | 'management' | 'audit';
}>) {
  return (
    <SidebarProvider
      defaultOpen
      className={cn('admin-app-shell', className)}
      style={
        {
          '--sidebar-width': '16.5rem',
          '--sidebar-width-mobile': '19rem',
          '--sidebar-width-icon': '3.25rem',
        } as React.CSSProperties
      }
    >
      {children}
    </SidebarProvider>
  );
}

export function AdminTopbar({
  breadcrumb,
  eyebrow,
  identity,
  actions,
}: Readonly<{
  breadcrumb?: React.ReactNode;
  eyebrow?: React.ReactNode;
  identity?: React.ReactNode;
  actions?: React.ReactNode;
}>) {
  const locale = useLocale();
  return (
    <header className="admin-topbar" data-slot="admin-topbar">
      <div className="admin-topbar__leading">
        <SidebarTrigger aria-label={translate(locale, 'admin.toggleNavigation')} />
        {breadcrumb ?? (eyebrow ? <span className="admin-topbar__eyebrow">{eyebrow}</span> : null)}
      </div>
      {identity ? <div className="admin-topbar__identity">{identity}</div> : null}
      <div className="admin-topbar__actions">
        <Button className="admin-quick-search" variant="outline" size="sm" type="button">
          <SearchIcon aria-hidden="true" />
          <span>{translate(locale, 'admin.search')}</span>
          <kbd>⌘ K</kbd>
        </Button>
        <Button className="admin-property-context" variant="outline" size="sm" type="button">
          <Building2Icon aria-hidden="true" />
          <span>{translate(locale, 'admin.propertyContext')}</span>
          <ChevronDownIcon aria-hidden="true" />
        </Button>
        {actions}
      </div>
    </header>
  );
}

export function AdminProfileMenu({
  displayName,
  role,
  department,
  profileHref = '/admin/profile',
  logout,
}: Readonly<{
  displayName: string;
  role: string;
  department?: string;
  profileHref?: string;
  logout: React.ReactNode;
}>) {
  const locale = useLocale();
  const visibleDisplayName =
    locale === 'vi' && displayName.trim().toLocaleLowerCase('en-US') === 'administrator'
      ? translate(locale, 'admin.actorAdministrator')
      : displayName;
  const initials = visibleDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="admin-profile-trigger"
            variant="ghost"
            aria-label={translate(locale, 'admin.openProfile')}
          />
        }
      >
        <Avatar size="sm" className="admin-profile-avatar">
          <AvatarFallback>{initials || <UserRoundIcon />}</AvatarFallback>
        </Avatar>
        <span className="admin-profile-trigger__copy">
          <strong>{visibleDisplayName}</strong>
          <small>{role}</small>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="admin-profile-menu">
        <div className="admin-profile-menu__summary">
          <strong>{visibleDisplayName}</strong>
          <span>{role}</span>
          {department ? <span>{department}</span> : null}
        </div>
        <DropdownMenuItem render={<a href={profileHref} />}>
          {translate(locale, 'admin.profileHeading')}
        </DropdownMenuItem>
        <div className="admin-profile-menu__logout">{logout}</div>
      </DropdownMenuContent>
    </DropdownMenu>
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

export function AdminTabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: Readonly<{
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <Tabs
      {...(defaultValue === undefined ? {} : { defaultValue })}
      {...(value === undefined ? {} : { value })}
      {...(onValueChange === undefined ? {} : { onValueChange })}
      className={cn('admin-tabs-system', className)}
    >
      {children}
    </Tabs>
  );
}

export { TabsContent as AdminTabContent, TabsList as AdminTabList, TabsTrigger as AdminTab };

export function AdminActiveFilters({
  filters,
  onClear,
  label,
  clearLabel,
}: Readonly<{
  filters: readonly { id: string; label: string; value: string }[];
  onClear: (id: string) => void;
  label?: string;
  clearLabel?: string;
}>) {
  const locale = useLocale();
  const resolvedLabel = label ?? translate(locale, 'admin.activeFilters');
  const resolvedClearLabel = clearLabel ?? translate(locale, 'admin.clearFilter');
  if (filters.length === 0) return null;
  return (
    <div className="admin-active-filters" aria-label={resolvedLabel}>
      <span className="admin-active-filters__label">{resolvedLabel}</span>
      {filters.map((filter) => (
        <Badge key={filter.id} variant="outline" className="admin-filter-chip">
          <span>
            {filter.label}: {filter.value}
          </span>
          <button
            type="button"
            aria-label={`${resolvedClearLabel}: ${filter.label}`}
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
  variant = 'operational',
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  variant?: 'operational' | 'management' | 'audit';
}>) {
  return (
    <div
      className={cn('admin-data-table', `admin-data-table--${variant}`, className)}
      data-slot="admin-data-table"
    >
      <div className="admin-data-table__scroll">{children}</div>
    </div>
  );
}

export function AdminTablePagination({
  page,
  pageCount,
  onPageChange,
  previousLabel,
  nextLabel,
}: Readonly<{
  page: number;
  pageCount: number;
  onPageChange?: (page: number) => void;
  previousLabel?: string;
  nextLabel?: string;
}>) {
  const locale = useLocale();
  const safePageCount = Number.isFinite(pageCount) && pageCount > 0 ? Math.floor(pageCount) : 1;
  const safePage =
    Number.isFinite(page) && page > 0 ? Math.min(Math.floor(page), safePageCount) : 1;
  const resolvedPreviousLabel = previousLabel ?? translate(locale, 'admin.previousPage');
  const resolvedNextLabel = nextLabel ?? translate(locale, 'admin.nextPage');
  return (
    <Pagination className="admin-table-pagination">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text={resolvedPreviousLabel}
            disabled={safePage === 1}
            onClick={() => {
              if (safePage === 1 || onPageChange === undefined) return;
              onPageChange(safePage - 1);
            }}
          />
        </PaginationItem>
        {Array.from({ length: safePageCount }, (_, index) => index + 1).map((value) => (
          <PaginationItem key={value}>
            <PaginationLink
              isActive={value === safePage}
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
            text={resolvedNextLabel}
            disabled={safePage === safePageCount}
            onClick={() => {
              if (safePage === safePageCount || onPageChange === undefined) return;
              onPageChange(safePage + 1);
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
    <Badge
      variant="outline"
      className={cn('admin-status-badge', `admin-status-badge--${tone}`)}
      data-tone={tone}
    >
      <span className="admin-status-badge__dot" aria-hidden="true" />
      {children}
    </Badge>
  );
}

export function AdminStatusText({
  tone = 'neutral',
  children,
}: Readonly<{ tone?: AdminStatusTone; children: React.ReactNode }>) {
  return (
    <span className={cn('admin-status-text', `admin-status-text--${tone}`)}>
      <span className="admin-status-text__dot" aria-hidden="true" />
      {children}
    </span>
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
      {open ? (
        <SheetContent className="admin-detail-sheet">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="admin-detail-sheet__body">{children}</div>
          {footer ? <SheetFooter>{footer}</SheetFooter> : null}
        </SheetContent>
      ) : null}
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
  action,
}: Readonly<{
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}>) {
  return (
    <Alert variant="destructive" className="admin-error-state">
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {action ? <div className="admin-error-state__action">{action}</div> : null}
    </Alert>
  );
}

export function AdminLoadingState({ label = 'Loading' }: Readonly<{ label?: React.ReactNode }>) {
  const locale = useLocale();
  return (
    <div className="admin-loading-state" role="status" aria-live="polite">
      <Spinner />
      <span>{label === 'Loading' ? translate(locale, 'admin.loading') : label}</span>
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
  const locale = useLocale();
  return (
    <div className="admin-responsive-actions">
      <div className="admin-responsive-actions__wide">{children}</div>
      <div className="admin-responsive-actions__compact">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={translate(locale, 'admin.otherActions')}
              />
            }
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
  placeholder,
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
  const locale = useLocale();
  const resolvedPlaceholder = placeholder ?? translate(locale, 'admin.chooseItem');
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
            ? resolvedPlaceholder
            : selectedLabels.length === 1
              ? selectedLabels[0]
              : translate(locale, 'admin.itemsSelected', { count: selectedLabels.length })}
        </span>
        <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="admin-multi-select__content">
        <Command>
          <CommandInput placeholder={translate(locale, 'admin.searchList')} />
          <CommandList>
            <CommandEmpty>{translate(locale, 'admin.noItemsMatch')}</CommandEmpty>
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
                    {checked ? (
                      <CheckIcon className="admin-multi-select__check" aria-hidden="true" />
                    ) : null}
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
